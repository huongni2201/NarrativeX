package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.catalog.application.port.in.VoiceCatalogAccess;
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
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenerateChapterNarrationUseCase {
  private static final String STAGE_NAME = "NARRATION_TTS";
  private static final String SEGMENTATION_VERSION = "sentence-v1";

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

    if (chapter.sourceText().isBlank()) {
      throw new IllegalArgumentException("Chapter source must be saved before narration");
    }
    var voiceCapabilities = resolveVoiceCapabilities(command.voiceId());
    validateSpeakingRate(command, voiceCapabilities);
    validateVoiceReferenceAsset(userId, command, voiceCapabilities);

    String fingerprint =
        fingerprintService.calculate(
            command.chapterId(),
            chapter.rowVersion(),
            chapter.sourceHash(),
            command.voiceId(),
            project.getSourceLanguage(),
            command.speakingRate(),
            SEGMENTATION_VERSION,
            command.voiceReferenceAssetId());
    String idempotencyKey = "chapter-narration:" + fingerprint;

    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      log.debug(
          "Found existing narration job id={} for idempotencyKey='{}'",
          existing.get().getId(),
          idempotencyKey);
      return existing.get();
    }

    var admission = admissionService.admit(userId, chapter, voiceCapabilities.localExecution());
    NarrationRequest narrationRequest =
        narrationRequestRepository.save(
            new NarrationRequest(
                UUID.randomUUID(),
                command.projectId(),
                command.chapterId(),
                chapter.rowVersion(),
                chapter.sourceHash(),
                chapter.sourceText(),
                command.voiceId(),
                project.getSourceLanguage(),
                command.speakingRate(),
                SEGMENTATION_VERSION,
                fingerprint,
                command.voiceReferenceAssetId()));

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
                UUID.randomUUID().toString(),
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
                chapter.sourceHash(),
                chapter.sourceText(),
                project.getSourceLanguage(),
                idempotencyKey));

    quotaReservation.bindToGenerationJob(admission.reservation().id(), job.getId());
    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));
    StageAttempt stageAttempt =
        stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    narrationOperationRepository.save(
        new NarrationOperation(
            UUID.randomUUID(), narrationRequest.id(), job.getId(), stageAttempt.getId()));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Created and enqueued narration job id={} (voiceId='{}', rate={}) for chapterId={}, projectId={}",
        job.getId(),
        command.voiceId(),
        command.speakingRate(),
        command.chapterId(),
        command.projectId());
    return job;
  }

  private VoiceCatalogAccess.VoiceCapabilities resolveVoiceCapabilities(String voiceId) {
    return voiceCatalogAccess
        .findVoice(voiceId)
        .orElseGet(
            () -> {
              boolean legacyVieNeu = voiceId.startsWith("vieneu-");
              log.warn(
                  "Voice id={} is missing from catalog; using legacy provider fallback", voiceId);
              return new VoiceCatalogAccess.VoiceCapabilities(
                  voiceId,
                  legacyVieNeu ? "VIENEU" : "UNKNOWN",
                  !legacyVieNeu,
                  legacyVieNeu,
                  legacyVieNeu,
                  48000,
                  legacyVieNeu ? "LOCAL_RETRYABLE" : "EXTERNAL_DURABLE");
            });
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
    if (command.voiceReferenceAssetId() == null) return;
    if (!voiceCapabilities.supportsVoiceClone()) {
      throw new IllegalArgumentException(
          "Selected narration voice does not support uploaded voice references");
    }
    var asset = voiceReferenceAssetAccess.findOwned(userId, command.voiceReferenceAssetId());
    if (!"AUDIO".equals(asset.type()) || !"READY".equals(asset.status())) {
      throw new IllegalArgumentException("Voice reference asset must be a READY audio asset");
    }
    if (!"audio/mpeg".equalsIgnoreCase(asset.contentType())
        && !"audio/mp3".equalsIgnoreCase(asset.contentType())) {
      throw new IllegalArgumentException("Voice reference upload must be an MP3 file");
    }
  }
}
