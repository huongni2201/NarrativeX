package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationOperationRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
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
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GenerateChapterNarrationUseCase {
  private static final String STAGE_NAME = "NARRATION_TTS";
  private static final String SEGMENTATION_VERSION = "sentence-v1";

  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
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

  @Transactional
  public GenerationJob execute(GenerateChapterNarrationCommand command) {
    String userId = currentUserId.get();
    var chapter = chapterSourceAccess.requireForAnalysisLocked(command.chapterId());
    storyVersionAccess.requireOwnedStoryVersion(
        command.projectId(), chapter.storyVersionId(), userId);
    var project = projectAccess.findOwnedProject(command.projectId(), userId);

    if (chapter.sourceText().isBlank()) {
      throw new IllegalArgumentException("Chapter source must be saved before narration");
    }

    String fingerprint =
        fingerprintService.calculate(
            command.chapterId(),
            chapter.rowVersion(),
            chapter.sourceHash(),
            command.voiceId(),
            project.getSourceLanguage(),
            command.speakingRate(),
            SEGMENTATION_VERSION);
    String idempotencyKey = "chapter-narration:" + fingerprint;

    generationJobRepository.acquireIdempotencyLock(idempotencyKey);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) {
      return existing.get();
    }

    var admission = admissionService.admit(userId, chapter);
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
                fingerprint));

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
        stageAttemptRepository.save(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    narrationOperationRepository.save(
        new NarrationOperation(
            UUID.randomUUID(), narrationRequest.id(), job.getId(), stageAttempt.getId()));
    generationOutboxRepository.enqueue(job);
    return job;
  }
}
