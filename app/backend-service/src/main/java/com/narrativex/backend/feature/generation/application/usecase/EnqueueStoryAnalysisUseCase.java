package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
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
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
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

  @Transactional
  public GenerationJob execute(EnqueueStoryAnalysisCommand command) {
    String userId = currentUserId.get();
    var chapter =
        chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(
            command.projectId(), command.chapterId(), userId);
    if (chapter.sourceText().isBlank()) {
      throw new IllegalArgumentException("Chapter source must be saved before analysis");
    }

    String baseIdempotencyKey =
        "chapter-analysis:"
            + command.projectId()
            + ":"
            + command.chapterId()
            + ":"
            + chapter.rowVersion()
            + ":"
            + chapter.sourceHash();

    generationJobRepository.acquireIdempotencyLock(baseIdempotencyKey, userId);
    var baseJob = generationJobRepository.findByIdempotencyKey(baseIdempotencyKey, userId);
    String idempotencyKey = baseIdempotencyKey;
    if (baseJob.isPresent()) {
      GenerationJob existing = baseJob.get();
      if (!canRetry(existing.getStatus())) {
        return existing;
      }
      var latest = generationJobRepository.findLatestByIdempotencyFamily(baseIdempotencyKey, userId);
      if (latest.isPresent() && !canRetry(latest.get().getStatus())) {
        return latest.get();
      }
      idempotencyKey = baseIdempotencyKey + ":retry:" + UuidV7.random();
      log.info(
          "Retrying chapter analysis after terminal job id={} with new idempotencyKey='{}'",
          latest.orElse(existing).getId(),
          idempotencyKey);
    }

    var project = projectAccess.findOwnedProject(command.projectId(), userId);
    String analysisLanguage = project.getSourceLanguage();
    var admission = admissionService.admit(userId, command.projectId(), chapter);
    var estimate = admission.estimate();

    UUID storyboardRevisionId =
        storyboardRevisionAccess.createDraft(
            command.chapterId(), chapter.sourceHash(), chapter.rowVersion());

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
                analysisLanguage,
                idempotencyKey,
                userId));

    quotaReservation.bindToGenerationJob(admission.reservation().id(), job.getId());
    operationPlanRepository.save(operationPlan.withGenerationJobId(job.getId()));
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE_NAME, 1));
    generationOutboxRepository.enqueue(job);
    log.info(
        "Enqueued story analysis job id={} for projectId={}, chapterId={}, storyboardRevisionId={}",
        job.getId(),
        command.projectId(),
        command.chapterId(),
        storyboardRevisionId);
    return job;
  }

  private static boolean canRetry(JobStatus status) {
    return status == JobStatus.FAILED || status == JobStatus.CANCELED;
  }
}
