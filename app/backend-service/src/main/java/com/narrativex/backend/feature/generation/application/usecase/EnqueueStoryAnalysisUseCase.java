package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisAdmissionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EnqueueStoryAnalysisUseCase {
  private static final String STAGE_NAME = "CHAPTER_ANALYSIS";

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterAnalysisSourceAccess;
  private final StoryboardRevisionAccess storyboardRevisionAccess;
  private final OperationPlanRepository operationPlanRepository;
  private final GenerationJobRepository generationJobRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final ChapterAnalysisAdmissionService admissionService;
  private final QuotaReservation quotaReservation;

  /**
   * Creates the complete durable boundary before any worker/provider submission can happen. The
   * Chapter source comes exclusively from PostgreSQL; the client never supplies analysis text.
   */
  @Transactional
  public GenerationJob execute(EnqueueStoryAnalysisCommand command) {
    String userId = currentUserId.get();

    // Authorize the project/chapter scope before acquiring the Chapter advisory lock. The lock is
    // then held through admission, quota reservation, revision/job creation, and outbox.
    var chapter =
        command.contentVariantId() == null
            ? chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(
                command.projectId(), command.chapterId(), userId)
            : chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(
                command.projectId(), command.chapterId(), userId, command.contentVariantId());
    var project = projectAccess.findOwnedProject(command.projectId(), userId);

    if (chapter.sourceText().isBlank()) {
      throw new IllegalArgumentException("Chapter source must be saved before analysis");
    }

    String idempotencyKey =
        "chapter-analysis:"
            + command.projectId()
            + ":"
            + command.chapterId()
            + ":"
            + chapter.sourceHash();

    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      return existing.get();
    }

    // Approved output for the same source is protected by the current storyboard revision; this
    // check runs before quota reservation so a duplicate analysis cannot consume capacity.
    var admission = admissionService.admit(userId, command.projectId(), chapter);
    var estimate = admission.estimate();

    Long storyboardRevisionId =
        chapter.contentVariantId() == null
            ? storyboardRevisionAccess.createDraft(
                command.chapterId(), chapter.sourceHash(), chapter.rowVersion())
            : storyboardRevisionAccess.createDraft(
                command.chapterId(), chapter.sourceHash(), chapter.rowVersion(), chapter.contentVariantId());

    OperationPlan operationPlan =
        operationPlanRepository.save(
            OperationPlan.create(
                command.projectId(),
                "CHAPTER_ANALYZE",
                estimate.estimateMin(),
                estimate.estimateMax(),
                estimate.maxAuthorizedCost()));

    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.createChapterAnalysis(
                command.projectId(),
                chapter.storyVersionId(),
                command.chapterId(),
                storyboardRevisionId,
                chapter.rowVersion(),
                chapter.sourceHash(),
                chapter.sourceText(),
                project.getSourceLanguage(),
                idempotencyKey,
                userId,
                chapter.contentVariantId()));

    quotaReservation.bindToGenerationJob(admission.reservation().id(), job.getId());
    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    return job;
  }
}
