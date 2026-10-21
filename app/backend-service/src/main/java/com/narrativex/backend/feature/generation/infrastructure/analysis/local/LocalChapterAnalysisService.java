package com.narrativex.backend.feature.generation.infrastructure.analysis.local;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.analysis.*;
import com.narrativex.backend.feature.generation.application.port.in.LocalChapterAnalysis;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisExecutionStore;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.*;
import com.narrativex.backend.feature.generation.infrastructure.analysis.ChapterAnalysisContractResources;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisArtifactMaterializer;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisJobHandler;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisExecutionMapper;
import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import com.narrativex.backend.feature.storyboard.application.service.SourceUnitSegmenter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
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
public class LocalChapterAnalysisService implements LocalChapterAnalysis {
  /** Desktop closed or crashed mid-run and kept no result. */
  static final String INTERRUPTED_CODE = "APP_INTERRUPTED";

  /** An UNKNOWN attempt that no result reached within the grace period. */
  static final String UNRESOLVED_CODE = "OUTCOME_UNRESOLVED";

  /**
   * Time after lease expiry during which an UNKNOWN attempt still holds its slot for a late result.
   */
  private static final Duration UNKNOWN_GRACE = Duration.ofMinutes(10);

  /**
   * A lease is short and renewed by the heartbeat that rides on the cancellation poll, so a Desktop
   * that vanished is noticed within minutes while a long (multi-window) run is never expired under
   * a healthy Desktop.
   */
  private static final Duration LEASE_WINDOW = Duration.ofMinutes(2);

  private static final Duration RENEW_BELOW = Duration.ofSeconds(90);

  /**
   * Failures that say nothing about the chapter and produced no output: the chapter goes back to
   * the queue.
   */
  private static final Set<String> REQUEUEABLE =
      Set.of(
          "RATE_LIMITED",
          "QUOTA_EXHAUSTED",
          "AUTH_REQUIRED",
          "MODEL_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE",
          "TOOL_DENIED");

  /**
   * Attempts per chapter before a requeueable failure becomes final, so a persistent fault cannot
   * loop forever.
   */
  private static final int MAX_ATTEMPTS = 5;

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
        mode,
        model,
        effort,
        ChapterAnalysisContractResources.VERSION,
        "0".repeat(64),
        ChapterAnalysisContractResources.VERSION,
        "0".repeat(64));
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
    if (!Objects.equals(adapterVersion, credential.adapterVersion())) {
      throw new ResourceConflictException(
          "Analysis adapter version changed; refresh the Desktop session");
    }
    if (!credential.eligibleAt(Instant.now())) return null;
    UUID publicJobId = mapper.findNextQueuedLocalJob(supportsStagedContracts(adapterVersion));
    if (publicJobId == null) return null;
    var job = jobs.findByJobId(publicJobId).orElseThrow();
    var snapshot = store.findSnapshot(job.getId()).orElseThrow();
    String lease = token();
    var attempt =
        new ChapterAnalysisExecutionAttempt(
            UuidV7.random(),
            job.getId(),
            mapper.lastAttemptNumber(job.getId()) + 1,
            claimRequestId,
            deviceId,
            credential.credentialRef(),
            credential.credentialGeneration(),
            attemptFingerprint(snapshot.inputFingerprint()),
            ChapterAnalysisAttemptCheckpoint.SUBMITTING,
            CanonHashCalculator.sha256(lease),
            Instant.now().plus(LEASE_WINDOW),
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
    transactions.claimForRunning(publicJobId, "ANTIGRAVITY_ANALYSIS", 0).orElseThrow();
    return new Claim(
        publicJobId,
        job.getProjectId(),
        attempt.attemptId(),
        lease,
        SourceUnitSegmenter.segment(job.getSourceText()).stream()
            .map(unit -> new ClaimUnit(unit.index(), unit.text()))
            .toList(),
        job.getSourceLanguage(),
        snapshot.profile(),
        snapshot.promptTemplate(),
        snapshot.responseSchema(),
        snapshot.stageContracts(),
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
    if (hasStageContracts(snapshot) && !supportsStagedContracts(completion.adapterVersion())) {
      throw new ResourceConflictException("STAGED_ANALYSIS_ADAPTER_REQUIRED");
    }
    if (!attemptFingerprint(snapshot.inputFingerprint()).equals(attempt.inputFingerprint())) {
      // The segmenter changed between claim and delivery, so the unit numbers in this result no
      // longer mean the same text.
      throw new IllegalArgumentException("SOURCE_UNITS_CHANGED");
    }
    if (hasStageContracts(snapshot)) {
      var finalError =
          handler
              .validateStagedFinal(
                  job,
                  completion.rawJson(),
                  snapshot.responseSchema(),
                  snapshot.stageContracts().get(ChapterAnalysisStage.CANON).responseSchema(),
                  snapshot.stageContracts().get(ChapterAnalysisStage.STORY).responseSchema())
              .stream()
              .filter(
                  found -> found.severity() == ChapterAnalysisArtifactMaterializer.Severity.ERROR)
              .findFirst();
      if (finalError.isPresent()) {
        var violation = finalError.get();
        throw new IllegalArgumentException(
            "ANALYSIS_OUTPUT_REJECTED: " + violation.path() + " " + violation.message());
      }
    }
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
    try {
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
    } catch (DataIntegrityViolationException exception) {
      // A constraint the model output broke (value too long, unexpected label) is deterministic:
      // retrying the same
      // payload can never succeed. Answer 400 so Desktop records it as a rejected result instead of
      // retrying forever.
      throw new IllegalArgumentException("ANALYSIS_OUTPUT_REJECTED", exception);
    }
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
    } else if (!job.isCancellationRequested()
        && REQUEUEABLE.contains(code)
        && attempt.attemptNumber() < MAX_ATTEMPTS) {
      transactions.markRequeued(job.getJobId(), code);
      update(
          attempt,
          attempt.observed(
              ChapterAnalysisAttemptCheckpoint.FAILED,
              attempt.conversationId(),
              attempt.outputHash(),
              attempt.completionPayloadHash(),
              code,
              false));
    } else {
      settleAsFailed(attempt, job, code, "Local chapter analysis did not complete");
    }
  }

  @Override
  @Transactional(readOnly = true)
  public List<Violation> validate(
      String deviceToken,
      UUID attemptId,
      String lease,
      String rawJson,
      int windowFirst,
      int windowLast) {
    return validateStage(
        deviceToken, attemptId, lease, rawJson, windowFirst, windowLast, null, null);
  }

  @Override
  @Transactional(readOnly = true)
  public List<Violation> validateStage(
      String deviceToken,
      UUID attemptId,
      String lease,
      String rawJson,
      int windowFirst,
      int windowLast,
      ChapterAnalysisStage stage,
      JsonNode canonContext) {
    var attempt = requireAttempt(deviceToken, attemptId, lease);
    if (!attempt.slotHeld()) throw new ResourceConflictException("Attempt is already terminal");
    if (rawJson.getBytes(StandardCharsets.UTF_8).length > configuration().maxOutputBytes()) {
      throw new IllegalArgumentException("OUTPUT_LIMIT_EXCEEDED");
    }
    var job = jobs.findById(attempt.generationJobId()).orElseThrow();
    if (stage == null) {
      return handler.validate(job, rawJson, windowFirst, windowLast).stream()
          .map(found -> new Violation(found.severity().name(), found.path(), found.message()))
          .toList();
    }
    var snapshot = store.findSnapshot(job.getId()).orElseThrow();
    if (!hasStageContracts(snapshot)) {
      return List.of(
          new Violation("ERROR", "$", "Analysis stage does not match the frozen contract"));
    }
    if (!snapshot.stageContracts().containsKey(stage)) {
      return List.of(
          new Violation("ERROR", "$", "Analysis stage is not present in the frozen contract"));
    }
    return handler
        .validateStage(
            job,
            stage,
            rawJson,
            windowFirst,
            windowLast,
            canonContext,
            snapshot.stageContracts().get(stage).responseSchema())
        .stream()
        .map(found -> new Violation(found.severity().name(), found.path(), found.message()))
        .toList();
  }

  private static boolean supportsStagedContracts(String adapterVersion) {
    return "antigravity-cli/3".equals(adapterVersion);
  }

  private static boolean hasStageContracts(ChapterAnalysisExecutionSnapshot snapshot) {
    return snapshot.stageContracts() != null && !snapshot.stageContracts().isEmpty();
  }

  /**
   * Desktop restarted without a retained result. The run lives only in the Desktop process, so no
   * result can ever arrive: the attempt is a definite failure the person may re-run, not an outcome
   * to reconcile.
   */
  @Transactional
  public void recoverClaim(String deviceToken, UUID claimRequestId) {
    UUID deviceId = devices.authenticate(deviceToken, "DESKTOP_APP").id();
    jobs.acquireAnalysisCapacityLock();
    store
        .findAttemptByClaimRequest(deviceId, claimRequestId)
        .filter(a -> a.slotHeld())
        .ifPresent(
            a ->
                settleAsFailed(
                    a,
                    jobs.findById(a.generationJobId()).orElseThrow(),
                    INTERRUPTED_CODE,
                    "Desktop closed before the analysis finished; run it again"));
  }

  @Transactional
  public boolean canceled(String deviceToken, UUID attemptId, String lease) {
    var a = requireAttempt(deviceToken, attemptId, lease);
    var job = jobs.findById(a.generationJobId()).orElseThrow();
    boolean canceled = job.isCancellationRequested() || job.getStatus().isTerminal();
    Instant now = Instant.now();
    if (!canceled && a.slotHeld() && a.leaseExpiresAt().isBefore(now.plus(RENEW_BELOW))) {
      // A lost race with another write is harmless: the next poll renews again.
      store.updateAttempt(a.withLease(now.plus(LEASE_WINDOW)), a.rowVersion(), a.fencingToken());
    }
    return canceled;
  }

  /**
   * Progress is a hint for the UI, so a lost race with the result or a cancellation is ignored. It
   * runs outside a transaction of its own so that such a conflict cannot poison anything else.
   */
  public void progress(String deviceToken, UUID attemptId, String lease, int progress) {
    var attempt = requireAttempt(deviceToken, attemptId, lease);
    if (!attempt.slotHeld()) return;
    var job = jobs.findById(attempt.generationJobId()).orElseThrow();
    recordProgress(job.getJobId(), progress, null);
  }

  @Override
  public void progressStage(
      String deviceToken, UUID attemptId, String lease, int progress, ChapterAnalysisStage stage) {
    if (stage == null) {
      progress(deviceToken, attemptId, lease, progress);
      return;
    }
    var attempt = requireAttempt(deviceToken, attemptId, lease);
    if (!attempt.slotHeld()) return;
    var job = jobs.findById(attempt.generationJobId()).orElseThrow();
    var snapshot = store.findSnapshot(job.getId()).orElse(null);
    if (snapshot == null
        || !hasStageContracts(snapshot)
        || !snapshot.stageContracts().containsKey(stage)) return;
    recordProgress(job.getJobId(), progress, "ANTIGRAVITY_ANALYSIS_" + stage.name());
  }

  private void recordProgress(UUID jobId, int progress, String stageStep) {
    try {
      if (stageStep == null) transactions.recordProgress(jobId, progress);
      else transactions.recordProgress(jobId, progress, stageStep);
    } catch (OptimisticLockingFailureException ignored) {
      // The job changed under us (result delivered, cancelled): the next report or the final state
      // wins.
    }
  }

  /** Binds the attempt to the unit numbering it was claimed with. */
  private static String attemptFingerprint(String snapshotFingerprint) {
    return CanonHashCalculator.sha256(
        snapshotFingerprint + "|units-v" + SourceUnitSegmenter.VERSION);
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
    // UNKNOWN keeps its slot only while a late result could still be delivered. After the grace
    // period nothing
    // can arrive, so the slot and the chapter are released; the person decides whether to run the
    // analysis again.
    for (UUID id : mapper.findStaleUnknownLocalAttempts(Instant.now().minus(UNKNOWN_GRACE))) {
      var a = store.findAttempt(id).orElseThrow();
      settleAsFailed(
          a,
          jobs.findById(a.generationJobId()).orElseThrow(),
          UNRESOLVED_CODE,
          "No result arrived from the local analysis; run it again");
    }
  }

  /**
   * Closes the attempt as a definite, user-retryable failure (or as canceled when cancellation was
   * requested).
   */
  private void settleAsFailed(
      ChapterAnalysisExecutionAttempt attempt, GenerationJob job, String code, String step) {
    if (job.isCancellationRequested())
      transactions.markCanceled(job.getJobId(), "USER_CANCELLED", "Local execution has stopped");
    else transactions.markSubmissionFailed(job.getJobId(), code, step);
    update(
        attempt,
        attempt.observed(
            ChapterAnalysisAttemptCheckpoint.FAILED,
            attempt.conversationId(),
            attempt.outputHash(),
            attempt.completionPayloadHash(),
            code,
            false));
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
}
