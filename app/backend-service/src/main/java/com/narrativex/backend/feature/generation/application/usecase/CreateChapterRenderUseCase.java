package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateChapterRenderCommand;
import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.RenderInputSnapshotRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterWorkspaceAccess;
import java.math.BigDecimal;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateChapterRenderUseCase {
  private static final String STAGE_NAME = "CHAPTER_RENDER";

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final ChapterWorkspaceAccess workspaceRepository;
  private final GenerationJobRepository generationJobRepository;
  private final GenerationOutboxRepository generationOutboxRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final MediaPlanRepository mediaPlanRepository;
  private final ChapterMediaHeadRepository chapterMediaHeadRepository;
  private final RenderInputSnapshotRepository renderInputSnapshotRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final QuotaReservation quotaReservation;
  private final UserQuotaAccess userQuotaAccess;

  @Transactional
  public GenerationJob execute(CreateChapterRenderCommand command) {
    String userId = currentUserId.get();
    var chapter =
        chapterSourceAccess.requireOwnedForAnalysisLocked(
            command.projectId(), command.chapterId(), userId);
    var project = projectAccess.findOwnedProject(command.projectId(), userId);
    var workspace = workspaceRepository.get(command.projectId(), command.chapterId());
    if (command.mediaPlanId() == null
        || command.mediaPlanRevision() == null
        || command.mediaPlanRevision() <= 0) {
      throw new GenerationAdmissionDeniedException(
          "MEDIA_PLAN_REQUIRED", "Rendering requires an approved media plan revision.");
    }
    if (!mediaPlanRepository.existsOwnedForChapter(
        command.mediaPlanId(), command.mediaPlanRevision(), command.chapterId(), userId)) {
      throw new GenerationAdmissionDeniedException(
          "MEDIA_PLAN_NOT_FOUND",
          "The requested media plan revision is not owned by this project.");
    }
    if (!chapterMediaHeadRepository.matchesCurrentPlan(
        command.chapterId(), command.mediaPlanId(), command.mediaPlanRevision())) {
      throw new GenerationAdmissionDeniedException(
          "MEDIA_PLAN_STALE",
          "The requested media plan is no longer the current visual-generation plan.");
    }
    if (!"COMPLETED".equals(workspace.analysis().status())) {
      throw new IllegalStateException("Chapter analysis must be completed before rendering");
    }
    var quota =
        userQuotaAccess
            .findCurrentQuota(userId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "ENTITLEMENT_DENIED", "No active plan."));
    if (!qualityAllowed(command.resolution(), quota.maxVideoQuality())) {
      throw new GenerationAdmissionDeniedException(
          "ENTITLEMENT_DENIED", "The requested resolution exceeds the active plan entitlement.");
    }
    if (!"COMPLETED".equals(workspace.projection().visualGeneration().status())
        || !"READY".equals(workspace.projection().audio().status())) {
      throw new IllegalStateException("Visuals and narration must be ready before rendering");
    }

    BigDecimal renderCost =
        "1080p".equals(command.resolution()) ? BigDecimal.valueOf(0.50) : BigDecimal.valueOf(0.25);
    if (command.maxAuthorizedCost() != null
        && renderCost.compareTo(command.maxAuthorizedCost()) > 0) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The requested render authorization cap is below the server estimate.");
    }
    String idempotencyKey =
        command.idempotencyKey() != null && !command.idempotencyKey().isBlank()
            ? command.idempotencyKey()
            : "chapter-render:"
                + command.projectId()
                + ":"
                + command.chapterId()
                + ":"
                + chapter.sourceHash()
                + ":"
                + command.mediaPlanId()
                + ":"
                + command.mediaPlanRevision()
                + ":"
                + command.resolution()
                + ":"
                + command.format();
    generationJobRepository.acquireIdempotencyLock(idempotencyKey, userId);
    var existing = generationJobRepository.findByIdempotencyKey(idempotencyKey, userId);
    if (existing.isPresent()) {
      log.debug(
          "Found existing render job id={} for idempotencyKey='{}'",
          existing.get().getId(),
          idempotencyKey);
      return existing.get();
    }

    var reservation =
        quotaReservation
            .reserve(userId, renderCost, quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "COST_LIMIT", "Render quota is exhausted."));
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
                command.mediaPlanId(),
                command.mediaPlanRevision(),
                userId));

    var renderSnapshot =
        renderInputSnapshotRepository.create(
            job.getId(),
            command.projectId(),
            command.chapterId(),
            chapter.rowVersion(),
            chapter.sourceHash(),
            command.mediaPlanId(),
            command.mediaPlanRevision());
    if (!renderSnapshot.complete()) {
      throw new GenerationAdmissionDeniedException(
          "RENDER_INPUT_NOT_READY",
          "Rendering requires one immutable narration asset and one READY image asset per planned beat.");
    }

    OperationPlan plan =
        operationPlanRepository.save(
            OperationPlan.create(
                command.projectId(),
                renderOperationType(command.resolution(), command.format()),
                renderCost.multiply(BigDecimal.valueOf(0.8)),
                renderCost,
                command.maxAuthorizedCost() == null ? renderCost : command.maxAuthorizedCost()));
    quotaReservation.bindToGenerationJob(reservation.id(), job.getId());
    operationPlanRepository.save(plan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Created and enqueued render job id={} (resolution='{}', format='{}') for chapterId={}, projectId={}",
        job.getId(),
        command.resolution(),
        command.format(),
        command.chapterId(),
        command.projectId());
    return job;
  }

  static String renderOperationType(String resolution, String format) {
    return STAGE_NAME
        + "_"
        + resolution.toUpperCase(Locale.ROOT)
        + "_"
        + format.toUpperCase(Locale.ROOT);
  }

  private static boolean qualityAllowed(String requestedResolution, String maximumQuality) {
    if (maximumQuality == null || maximumQuality.isBlank()) return false;
    int requested = "1080p".equalsIgnoreCase(requestedResolution) ? 3 : 1;
    int maximum =
        switch (maximumQuality.toUpperCase()) {
          case "DRAFT", "720P" -> 1;
          case "STANDARD" -> 2;
          case "HIGH", "1080P" -> 3;
          case "ULTRA" -> 4;
          default -> 0;
        };
    return maximum >= requested;
  }
}
