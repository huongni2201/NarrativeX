package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisAdmissionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EnqueueStoryAnalysisUseCase {
  private static final String STAGE_NAME = "CHAPTER_ANALYSIS";

  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterAnalysisSourceAccess;
  private final OperationPlanRepository operationPlanRepository;
  private final GenerationJobRepository generationJobRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final ChapterAnalysisAdmissionService admissionService;

  /**
   * Creates the complete durable boundary before any worker/provider submission can happen. The
   * Chapter source comes exclusively from PostgreSQL; the client never supplies analysis text.
   */
  @Transactional
  public GenerationJob execute(EnqueueStoryAnalysisCommand command) {
    String userId = currentUserId.get();
    var chapter = chapterAnalysisSourceAccess.requireById(command.chapterId());

    storyVersionAccess.requireOwnedStoryVersion(
        command.projectId(), chapter.storyVersionId(), userId);
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

    // Serialize identical requests inside this PostgreSQL transaction. A concurrent request waits
    // for the first transaction to commit, then observes and returns the already-created job.
    generationJobRepository.acquireIdempotencyLock(idempotencyKey);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) {
      return existing.get();
    }

    var estimate = admissionService.admit(userId, command.projectId(), chapter);
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
                chapter.rowVersion(),
                chapter.sourceHash(),
                chapter.sourceText(),
                project.getSourceLanguage(),
                idempotencyKey,
                userId));

    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));

    stageAttemptRepository.save(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    return job;
  }
}
