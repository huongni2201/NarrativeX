package com.narrativex.backend.feature.generation.infrastructure.analysis.local;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.analysis.*;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisExecutionStore;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.enums.*;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisJobHandler;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisExecutionMapper;
import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

/**
 * Local analysis execution through the one agy session owned by a Desktop device. PostgreSQL owns
 * admission and terminal materialization; provider tokens never reach the backend.
 */
@Service
@RequiredArgsConstructor
public class LocalChapterAnalysisService {
  private final ChapterAnalysisExecutionStore store;
  private final ChapterAnalysisExecutionMapper mapper;
  private final GenerationJobRepository jobs;
  private final GenerationJobTransactionService transactions;
  private final LocalDeviceAccess devices;
  private final ChapterAnalysisJobHandler handler;

  public AnalysisRuntimeConfiguration configuration() {
    return store.findRuntimeConfiguration();
  }

  @Transactional
  public AnalysisRuntimeConfiguration configure(
      ChapterAnalysisExecutionMode mode,
      String model,
      String effort,
      int maxConcurrentAnalyses,
      long rowVersion) {
    if (mode != ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI) {
      throw new IllegalArgumentException(mode + " is retired; use ANTIGRAVITY_CLI");
    }
    var c = configuration();
    var desired =
        new AnalysisRuntimeConfiguration(
            c.revision(),
            mode,
            model,
            effort,
            maxConcurrentAnalyses,
            c.maxQueuedAnalyses(),
            c.maxInputBytes(),
            c.maxOutputBytes(),
            c.maxRuntimeMs(),
            rowVersion);
    new ChapterAnalysisExecutionProfile(
        mode, model, effort, "1.1", "0".repeat(64), "1.1", "0".repeat(64));
    return store
        .updateRuntimeConfiguration(desired, rowVersion)
        .orElseThrow(
            () -> new ResourceConflictException("Analysis settings changed; reload before saving"));
  }

  /** Registers the one local agy session assigned to this Desktop device. */
  @Transactional
  public AnalysisProviderCredential registerCredential(
      String deviceToken,
      String fingerprint,
      String label,
      String adapterVersion,
      List<String> models) {
    UUID deviceId = devices.authenticate(deviceToken, "DESKTOP_APP").id();
    jobs.acquireAnalysisCapacityLock();
    var existing = store.findCredentialByDevice(deviceId);
    if (existing.isPresent()) {
      var c = existing.get();
      if (!fingerprint.equals(c.connectionFingerprint())) {
        throw new ResourceConflictException("This Desktop already has an agy session slot");
      }
      return store
          .updateCredential(c.withIdentity(label, adapterVersion, models), c.rowVersion())
          .orElseThrow(() -> new ResourceConflictException("Analysis credential changed"));
    }
    return store.insertCredential(
        new AnalysisProviderCredential(
            UuidV7.random(),
            deviceId,
            fingerprint,
            1,
            label,
            "UNKNOWN",
            adapterVersion,
            models,
            "UNKNOWN",
            null,
            null,
            null,
            0,
            0));
  }

  @Transactional
  public void observeCredential(
      String deviceToken,
      UUID credentialRef,
      String connectionState,
      String quotaState,
      Instant nextEligibleAt) {
    UUID deviceId = devices.authenticate(deviceToken, "DESKTOP_APP").id();
    jobs.acquireAnalysisCapacityLock();
    var c = ownedCredential(deviceId, credentialRef);
    store
        .updateCredential(
            c.observed(connectionState, quotaState, nextEligibleAt, Instant.now()), c.rowVersion())
        .orElseThrow(() -> new ResourceConflictException("Analysis credential changed"));
  }

  @Transactional
  public Claim claim(
      String deviceToken, UUID claimRequestId, UUID credentialRef, String adapterVersion) {
    UUID deviceId = devices.authenticate(deviceToken, "DESKTOP_APP").id();
    jobs.acquireAnalysisCapacityLock();
    // A lost claim ACK never grants permission to execute a second time.
    if (store.findAttemptByClaimRequest(deviceId, claimRequestId).isPresent()) return null;
    var config = configuration();
    if (mapper.countHeldLocalSlots() >= config.maxConcurrentAnalyses()) return null;
    var credential = ownedCredential(deviceId, credentialRef);
    if (!credential.eligibleAt(Instant.now())) return null;
    UUID publicJobId = mapper.findNextQueuedLocalJob();
    if (publicJobId == null) return null;
    var job = jobs.findByJobId(publicJobId).orElseThrow();
    var snapshot = store.findSnapshot(job.getId()).orElseThrow();
    String lease = token();
    var attempt =
        new ChapterAnalysisExecutionAttempt(
            UuidV7.random(),
            job.getId(),
            1,
            claimRequestId,
            deviceId,
            credential.credentialRef(),
            credential.credentialGeneration(),
            snapshot.inputFingerprint(),
            ChapterAnalysisAttemptCheckpoint.SUBMITTING,
            CanonHashCalculator.sha256(lease),
            Instant.now().plusMillis(config.maxRuntimeMs() + 60_000),
            1,
            0,
            UuidV7.random(),
            null,
            null,
            null,
            null,
            true,
            0,
            null,
            null);
    store.insertAttempt(attempt);
    transactions.claimForRunning(publicJobId, "ANTIGRAVITY_ANALYSIS", 10).orElseThrow();
    return new Claim(
        publicJobId,
        job.getProjectId(),
        attempt.attemptId(),
        lease,
        job.getSourceText(),
        job.getSourceLanguage(),
        snapshot.profile(),
        snapshot.promptTemplate(),
        snapshot.responseSchema(),
        config.maxInputBytes(),
        config.maxOutputBytes(),
        config.maxRuntimeMs());
  }

  @Transactional
  public void complete(String deviceToken, UUID attemptId, Completion completion) {
    var attempt = requireAttempt(deviceToken, attemptId, completion.leaseToken());
    String outputHash = CanonHashCalculator.sha256(completion.rawJson());
    String payloadHash = CanonHashCalculator.sha256(completion.toString());
    if (attempt.checkpoint() == ChapterAnalysisAttemptCheckpoint.DELIVERED) {
      if (!payloadHash.equals(attempt.completionPayloadHash()))
        throw new ResourceConflictException("RESULT_CONFLICT");
      return;
    }
    if (!attempt.slotHeld()) throw new ResourceConflictException("Attempt is already terminal");
    var job = jobs.findById(attempt.generationJobId()).orElseThrow();
    if (job.getStatus().isTerminal() || job.isCancellationRequested()) {
      throw new ResourceConflictException("Analysis was canceled or is already terminal");
    }
    if (completion.rawJson().getBytes(StandardCharsets.UTF_8).length
        > configuration().maxOutputBytes()) {
      throw new IllegalArgumentException("OUTPUT_LIMIT_EXCEEDED");
    }
    var snapshot = store.findSnapshot(job.getId()).orElseThrow();
    var request =
        new ChapterAnalysisRequest(
            job.getProjectId(),
            job.getChapterId(),
            job.getStoryboardRevisionId(),
            job.getSourceText(),
            job.getSourceLanguage(),
            snapshot.profile().promptVersion(),
            snapshot.profile().schemaVersion(),
            null,
            null);
    var usage = completion.usage();
    var result =
        new ChapterAnalysisResult(
            completion.rawJson(),
            usage,
            snapshot.profile().model(),
            CanonHashCalculator.computeCanonHash(completion.rawJson()),
            snapshot.profile().promptHash(),
            snapshot.profile().schemaHash());
    handler.materializeAndComplete(
        job,
        request,
        result,
        new ChapterAnalysisJobHandler.LocalProvenance(
            attemptId,
            attempt.credentialRef(),
            completion.adapterVersion(),
            completion.conversationId(),
            snapshot.profile().executionMode()));
    update(
        attempt,
        attempt.observed(
            ChapterAnalysisAttemptCheckpoint.DELIVERED,
            completion.conversationId(),
            outputHash,
            payloadHash,
            null,
            false));
  }

  @Transactional
  public void report(
      String deviceToken, UUID attemptId, String lease, String code, boolean ambiguous) {
    var attempt = requireAttempt(deviceToken, attemptId, lease);
    if (!attempt.slotHeld()) return;
    var job = jobs.findById(attempt.generationJobId()).orElseThrow();
    if (ambiguous) {
      transactions.markSubmissionUnknown(
          job.getJobId(),
          code,
          "Local outcome requires reconciliation; no automatic resubmission",
          null);
      update(
          attempt,
          attempt.observed(ChapterAnalysisAttemptCheckpoint.UNKNOWN, null, null, null, code, true));
    } else {
      if (job.isCancellationRequested())
        transactions.markCanceled(job.getJobId(), "USER_CANCELLED", "Local execution has stopped");
      else
        transactions.markSubmissionFailed(
            job.getJobId(), code, "Local chapter analysis did not complete");
      update(
          attempt,
          attempt.observed(ChapterAnalysisAttemptCheckpoint.FAILED, null, null, null, code, false));
    }
  }

  @Transactional
  public void recoverClaim(String deviceToken, UUID claimRequestId) {
    UUID deviceId = devices.authenticate(deviceToken, "DESKTOP_APP").id();
    jobs.acquireAnalysisCapacityLock();
    store
        .findAttemptByClaimRequest(deviceId, claimRequestId)
        .filter(a -> a.slotHeld())
        .ifPresent(
            a -> {
              var job = jobs.findById(a.generationJobId()).orElseThrow();
              transactions.markSubmissionUnknown(
                  job.getJobId(),
                  "AMBIGUOUS_OUTCOME",
                  "Desktop interrupted before retaining the result",
                  null);
              update(
                  a,
                  a.observed(
                      ChapterAnalysisAttemptCheckpoint.UNKNOWN,
                      null,
                      null,
                      null,
                      "AMBIGUOUS_OUTCOME",
                      true));
            });
  }

  @Transactional(readOnly = true)
  public boolean canceled(String deviceToken, UUID attemptId, String lease) {
    var a = requireAttempt(deviceToken, attemptId, lease);
    var job = jobs.findById(a.generationJobId()).orElseThrow();
    return job.isCancellationRequested() || job.getStatus().isTerminal();
  }

  @Scheduled(fixedDelay = 30_000)
  @Transactional
  public void expireObservations() {
    jobs.acquireAnalysisCapacityLock();
    for (UUID id : mapper.findExpiredLocalAttempts(Instant.now())) {
      var a = store.findAttempt(id).orElseThrow();
      var job = jobs.findById(a.generationJobId()).orElseThrow();
      transactions.markSubmissionUnknown(
          job.getJobId(), "DEVICE_OFFLINE", "Awaiting local result; execution slot retained", null);
      update(
          a,
          a.observed(
              ChapterAnalysisAttemptCheckpoint.UNKNOWN,
              a.conversationId(),
              a.outputHash(),
              a.completionPayloadHash(),
              "DEVICE_OFFLINE",
              true));
    }
  }

  private AnalysisProviderCredential ownedCredential(UUID deviceId, UUID credentialRef) {
    return store
        .findCredential(credentialRef)
        .filter(c -> c.deviceId().equals(deviceId))
        .orElseThrow(() -> new ResourceNotFoundException("Analysis credential not found"));
  }

  private ChapterAnalysisExecutionAttempt requireAttempt(
      String deviceToken, UUID attemptId, String lease) {
    UUID deviceId = devices.authenticate(deviceToken, "DESKTOP_APP").id();
    var a =
        store
            .findAttempt(attemptId)
            .orElseThrow(() -> new ResourceNotFoundException("Analysis attempt not found"));
    if (!a.deviceId().equals(deviceId)
        || lease == null
        || !MessageDigest.isEqual(
            a.leaseTokenHash().getBytes(StandardCharsets.US_ASCII),
            CanonHashCalculator.sha256(lease).getBytes(StandardCharsets.US_ASCII))) {
      throw new ResourceConflictException("Analysis lease does not match this device");
    }
    return a;
  }

  private void update(ChapterAnalysisExecutionAttempt old, ChapterAnalysisExecutionAttempt next) {
    if (!store.updateAttempt(next, old.rowVersion(), old.fencingToken()))
      throw new ResourceConflictException("Analysis attempt changed");
  }

  private static String token() {
    byte[] bytes = new byte[32];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  public record Claim(
      UUID jobId,
      UUID projectId,
      UUID attemptId,
      String leaseToken,
      String sourceText,
      String sourceLanguage,
      ChapterAnalysisExecutionProfile profile,
      String promptTemplate,
      JsonNode responseSchema,
      long maxInputBytes,
      long maxOutputBytes,
      long maxRuntimeMs) {}

  public record Completion(
      String leaseToken,
      String rawJson,
      ChapterAnalysisUsage usage,
      String adapterVersion,
      String conversationId) {}
}
