package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.catalog.application.port.in.VoiceCatalogAccess;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationOperationRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.port.out.VoiceReferenceAssetAccess;
import com.narrativex.backend.feature.generation.application.service.NarrationAdmissionService;
import com.narrativex.backend.feature.generation.application.service.NarrationRequestFingerprint;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.NarrationOperation;
import com.narrativex.backend.feature.generation.domain.entity.NarrationRequest;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenerateChapterNarrationUseCase {
  private static final String STAGE_NAME = "NARRATION_TTS";
  private static final String SEGMENTATION_VERSION = "sentence-v1";
  private static final String PREVIEW_HASH_DOMAIN = "NARRATIVEX_VOICE_PREVIEW\u0000";

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final GenerationJobRepository generationJobRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final NarrationRequestRepository narrationRequestRepository;
  private final NarrationOperationRepository narrationOperationRepository;
  private final NarrationAdmissionService admissionService;
  private final NarrationRequestFingerprint fingerprintService;
  private final QuotaReservation quotaReservation;
  private final VoiceReferenceAssetAccess voiceReferenceAssetAccess;
  private final VoiceCatalogAccess voiceCatalogAccess;

  @Transactional
  public GenerationJob execute(GenerateChapterNarrationCommand command) {
    String userId = currentUserId.get();
    var chapter =
        chapterSourceAccess.requireOwnedForAnalysisLocked(
            command.projectId(), command.chapterId(), userId);
    var project = projectAccess.findOwnedProject(command.projectId(), userId);

    String sourceText = command.preview() ? command.previewText() : chapter.sourceText();
    if (sourceText == null || sourceText.isBlank()) {
      throw new IllegalArgumentException("Chapter source must be saved before narration");
    }
    String sourceHash = command.preview() ? previewSourceHash(sourceText) : chapter.sourceHash();

    var voiceCapabilities = resolveVoiceCapabilities(command.voiceId());
    validateSpeakingRate(command, voiceCapabilities);
    validateVoiceReferenceAsset(userId, command, voiceCapabilities);

    String fingerprint =
        fingerprintService.calculate(
            command.chapterId(),
            chapter.rowVersion(),
            sourceHash,
            command.voiceId(),
            project.getSourceLanguage(),
            command.speakingRate(),
            SEGMENTATION_VERSION,
            command.voiceReference());
    String familyPrefix = command.preview() ? "voice-preview:" : "chapter-narration:";
    String baseIdempotencyKey = familyPrefix + fingerprint;
    boolean forceRegenerate = !command.preview() && command.forceRegenerate();

    generationJobRepository.acquireIdempotencyLock(baseIdempotencyKey, userId);
    var baseJob = generationJobRepository.findByIdempotencyKey(baseIdempotencyKey, userId);
    String idempotencyKey = baseIdempotencyKey;
    if (baseJob.isPresent()) {
      GenerationJob existing = baseJob.get();
      if (!canStartAnotherAttempt(existing.getStatus(), forceRegenerate)) {
        return existing;
      }
      var latest =
          generationJobRepository.findLatestByIdempotencyFamily(baseIdempotencyKey, userId);
      if (latest.isPresent()
          && !canStartAnotherAttempt(latest.get().getStatus(), forceRegenerate)) {
        return latest.get();
      }
      idempotencyKey = baseIdempotencyKey + ":retry:" + UuidV7.random();
      log.info(
          "Starting another narration attempt after terminal job id={} with new idempotencyKey='{}'",
          latest.orElse(existing).getId(),
          idempotencyKey);
    }

    var admission =
        admissionService.admitText(userId, sourceText, voiceCapabilities.localExecution());
    NarrationRequest narrationRequest =
        narrationRequestRepository.save(
            new NarrationRequest(
                UuidV7.random(),
                command.projectId(),
                command.chapterId(),
                chapter.rowVersion(),
                sourceHash,
                sourceText,
                command.voiceId(),
                project.getSourceLanguage(),
                command.speakingRate(),
                SEGMENTATION_VERSION,
                fingerprint,
                command.voiceReference()));

    OperationPlan operationPlan =
        operationPlanRepository.save(
            OperationPlan.create(
                command.projectId(),
                STAGE_NAME,
                admission.estimate().estimateMin(),
                admission.estimate().estimateMax(),
                admission.estimate().maxAuthorizedCost()));

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.rehydrate(
                null,
                0L,
                UuidV7.random(),
                command.projectId(),
                JobType.NARRATION_GENERATE,
                JobStatus.QUEUED,
                ResourceClass.PROVIDER_INTERACTIVE,
                0,
                "QUEUED",
                null,
                userId,
                userId,
                chapter.storyVersionId(),
                command.chapterId(),
                null,
                chapter.rowVersion(),
                sourceHash,
                sourceText,
                project.getSourceLanguage(),
                idempotencyKey));

    quotaReservation.bindToGenerationJob(admission.reservation().id(), job.getId());
    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));
    StageAttempt stageAttempt =
        stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    narrationOperationRepository.save(
        new NarrationOperation(
            UuidV7.random(), narrationRequest.id(), job.getId(), stageAttempt.getId()));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Prepared {} rowId={} jobId={} (voiceId='{}', rate={}) for chapterId={}, projectId={}",
        command.preview() ? "voice preview" : "narration job",
        job.getId(),
        job.getJobId(),
        command.voiceId(),
        command.speakingRate(),
        command.chapterId(),
        command.projectId());
    registerCommittedLog(job, command);
    return job;
  }

  private void registerCommittedLog(GenerationJob job, GenerateChapterNarrationCommand command) {
    Runnable committedLog =
        () ->
            log.info(
                "Committed {} rowId={} jobId={} for chapterId={}, projectId={}",
                command.preview() ? "voice preview" : "narration job",
                job.getId(),
                job.getJobId(),
                command.chapterId(),
                command.projectId());
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              committedLog.run();
            }
          });
      return;
    }
    log.warn(
        "Narration job commit observer unavailable rowId={} jobId={}", job.getId(), job.getJobId());
  }

  static boolean canStartAnotherAttempt(JobStatus status, boolean forceRegenerate) {
    return status == JobStatus.FAILED
        || status == JobStatus.CANCELED
        || (forceRegenerate && status == JobStatus.COMPLETED);
  }

  private VoiceCatalogAccess.VoiceCapabilities resolveVoiceCapabilities(String voiceId) {
    return voiceCatalogAccess
        .findVoice(voiceId)
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Selected narration voice is unavailable or disabled: " + voiceId));
  }

  private void validateSpeakingRate(
      GenerateChapterNarrationCommand command,
      VoiceCatalogAccess.VoiceCapabilities voiceCapabilities) {
    if (!voiceCapabilities.supportsSpeakingRate()
        && command.speakingRate().compareTo(BigDecimal.ONE) != 0) {
      throw new IllegalArgumentException("Selected narration voice supports speakingRate=1.0 only");
    }
  }

  private void validateVoiceReferenceAsset(
      String userId,
      GenerateChapterNarrationCommand command,
      VoiceCatalogAccess.VoiceCapabilities voiceCapabilities) {
    if (command.voiceReference() == null) return;
    if (!voiceCapabilities.supportsVoiceClone()) {
      throw new IllegalArgumentException(
          "Selected narration voice does not support uploaded voice references");
    }
    var asset =
        voiceReferenceAssetAccess.findOwned(userId, command.projectId(), command.voiceReference());
    if (!"READY".equals(asset.status())) {
      throw new IllegalArgumentException("Voice reference asset must be READY");
    }
    if (asset.sizeBytes() <= 0
        || asset.sha256() == null
        || !asset.sha256().matches("^[0-9a-fA-F]{64}$")) {
      throw new IllegalArgumentException("Voice reference asset integrity metadata is invalid");
    }
    if (asset.scope() == VoiceReferenceScope.ACCOUNT
        && (asset.storageKey() == null || asset.storageKey().isBlank())) {
      throw new IllegalArgumentException(
          "Account voice reference asset is missing R2 storage metadata");
    }
    if (asset.scope() == VoiceReferenceScope.PROJECT && asset.storageKey() != null) {
      throw new IllegalArgumentException("Project voice reference must remain device-local");
    }
    if (!isSupportedVoiceReferenceContentType(asset.contentType())) {
      throw new IllegalArgumentException("Voice reference upload must be an MP3 or WAV file");
    }
  }

  private static boolean isSupportedVoiceReferenceContentType(String contentType) {
    if (contentType == null) return false;
    return "audio/mpeg".equalsIgnoreCase(contentType)
        || "audio/mp3".equalsIgnoreCase(contentType)
        || "audio/wav".equalsIgnoreCase(contentType)
        || "audio/x-wav".equalsIgnoreCase(contentType);
  }

  private static String previewSourceHash(String sourceText) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256")
              .digest((PREVIEW_HASH_DOMAIN + sourceText).getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }
}
