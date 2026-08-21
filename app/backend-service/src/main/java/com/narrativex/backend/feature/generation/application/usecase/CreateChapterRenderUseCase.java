package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateChapterRenderCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterWorkspaceReadRepository;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateChapterRenderUseCase {
  private static final BigDecimal ESTIMATED_COST = BigDecimal.valueOf(0.15);
  private static final String STAGE_NAME = "CHAPTER_RENDER";

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final ChapterWorkspaceReadRepository workspaceRepository;
  private final GenerationJobRepository generationJobRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final QuotaReservation quotaReservation;
  private final UserQuotaAccess userQuotaAccess;

  @Transactional
  public GenerationJob execute(CreateChapterRenderCommand command) {
    String userId = currentUserId.get();
    var chapter =
        chapterSourceAccess.requireOwnedForAnalysisLocked(command.projectId(), command.chapterId(), userId);
    var project = projectAccess.findOwnedProject(command.projectId(), userId);
    var workspace = workspaceRepository.get(command.projectId(), command.chapterId());
    if (!"COMPLETED".equals(workspace.analysis().status())) {
      throw new IllegalStateException("Chapter analysis must be completed before rendering");
    }
    if (!"COMPLETED".equals(workspace.projection().visualGeneration().status())
        || !"READY".equals(workspace.projection().audio().status())) {
      throw new IllegalStateException("Visuals and narration must be ready before rendering");
    }

    String idempotencyKey =
        "chapter-render:"
            + command.projectId()
            + ":"
            + command.chapterId()
            + ":"
            + chapter.sourceHash()
            + ":"
            + command.resolution()
            + ":"
            + command.format();
    generationJobRepository.acquireIdempotencyLock(idempotencyKey);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) return existing.get();

    var quota =
        userQuotaAccess
            .findCurrentQuota(userId)
            .orElseThrow(() -> new GenerationAdmissionDeniedException("COST_LIMIT", "No active plan."));
    var reservation =
        quotaReservation
            .reserve(userId, ESTIMATED_COST, quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () -> new GenerationAdmissionDeniedException("COST_LIMIT", "Render quota is exhausted."));
    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.createChapterRender(
                command.projectId(),
                chapter.storyVersionId(),
                command.chapterId(),
                chapter.rowVersion(),
                chapter.sourceHash(),
                chapter.sourceText(),
                project.getSourceLanguage(),
                idempotencyKey,
                userId));
    OperationPlan plan =
        operationPlanRepository.save(
            OperationPlan.create(
                command.projectId(), STAGE_NAME, ESTIMATED_COST, ESTIMATED_COST, ESTIMATED_COST));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(plan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    return job;
  }
}
