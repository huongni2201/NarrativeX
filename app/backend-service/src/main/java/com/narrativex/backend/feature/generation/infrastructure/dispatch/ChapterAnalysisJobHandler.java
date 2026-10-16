package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.model.analysis.CanonHashCalculator;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRetirement;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AttentionEventMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.HookPlanMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.RetentionMapMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Handler for CHAPTER_ANALYZE generation jobs. Analysis runs through Desktop's agy CLI (ADR-0009):
 * analysis runs on the Desktop app through a Google account, which claims the frozen job and
 * delivers the result through {@code LocalChapterAnalysisService}. This handler only materializes
 * delivered results and retires jobs that can no longer be claimed.
 */
@Slf4j
@Component
public class ChapterAnalysisJobHandler implements GenerationJobHandler {
  private final GenerationJobRepository generationJobRepository;
  private final GenerationJobTransactionService transactionService;
  private final ChapterAnalysisArtifactMaterializer analysisMaterializer;
  private final ChapterAnalysisRunRepository analysisRunRepository;
  private final ChapterMapper chapterMapper;

  @Autowired(required = false)
  private com.narrativex.backend.feature.generation.application.port.out
          .ChapterAnalysisExecutionStore
      localExecutions;

  @Autowired
  public ChapterAnalysisJobHandler(
      GenerationJobRepository generationJobRepository,
      GenerationJobTransactionService transactionService,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      @Autowired(required = false) ChapterCanonMapper canonMapper,
      @Autowired(required = false) ChapterCanonReconciliationService canonReconciliationService,
      @Autowired(required = false) ChapterAnalysisRunRepository analysisRunRepository,
      @Autowired(required = false) HookPlanMapper hookPlanMapper,
      @Autowired(required = false) RetentionMapMapper retentionMapMapper,
      @Autowired(required = false) AttentionEventMapper attentionEventMapper,
      @Autowired(required = false) ShotSequenceMapper shotSequenceMapper,
      @Autowired(required = false) ShotMapper shotMapper) {
    this.generationJobRepository = generationJobRepository;
    this.transactionService = transactionService;
    this.chapterMapper = chapterMapper;
    this.analysisRunRepository = analysisRunRepository;
    this.analysisMaterializer =
        new ChapterAnalysisArtifactMaterializer(
            storyboardMapper,
            chapterMapper,
            new SourceAnchorResolver(),
            canonMapper,
            canonReconciliationService,
            hookPlanMapper,
            retentionMapMapper,
            attentionEventMapper,
            shotSequenceMapper,
            shotMapper);
  }

  public ChapterAnalysisJobHandler(
      GenerationJobRepository generationJobRepository,
      GenerationJobTransactionService transactionService,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService,
      ChapterAnalysisRunRepository analysisRunRepository) {
    this(
        generationJobRepository,
        transactionService,
        storyboardMapper,
        chapterMapper,
        canonMapper,
        canonReconciliationService,
        analysisRunRepository,
        null,
        null,
        null,
        null,
        null);
  }

  @Override
  public JobType supportedType() {
    return JobType.CHAPTER_ANALYZE;
  }

  @Override
  public DispatchLane lane() {
    return DispatchLane.ANALYSIS;
  }

  @Override
  public void execute(UUID jobId) {
    Optional<GenerationJob> found = generationJobRepository.findByJobId(jobId);
    if (found.isEmpty()) {
      return;
    }
    GenerationJob job = found.get();
    if (localExecutions == null || localExecutions.findSnapshot(job.getId()).isPresent()) {
      // Frozen for Desktop: the job stays QUEUED until an enabled Google account claims it.
      return;
    }
    // Admitted while the backend still analyzed chapters itself: nothing can claim or reconcile it.
    log.warn(
        "Retiring chapter analysis job {}: no Desktop execution snapshot was frozen at admission",
        jobId);
    transactionService.markSubmissionFailed(
        jobId, ChapterAnalysisRetirement.ERROR_CODE, ChapterAnalysisRetirement.STEP);
  }

  public record LocalProvenance(
      UUID attemptId,
      UUID credentialRef,
      String adapterVersion,
      String conversationId,
      ChapterAnalysisExecutionMode executionMode) {}

  /** Reports what is wrong with a delivered result without writing anything. */
  public java.util.List<ChapterAnalysisArtifactMaterializer.Violation> validate(
      GenerationJob job, String rawJson, int windowFirst, int windowLast) {
    return analysisMaterializer.validate(
        job, rawJson.getBytes(StandardCharsets.UTF_8), windowFirst, windowLast);
  }

  public void materializeAndComplete(
      GenerationJob job,
      ChapterAnalysisRequest request,
      ChapterAnalysisResult result,
      LocalProvenance local) {
    Objects.requireNonNull(local, "local provenance is required");
    byte[] payload = result.rawJson().getBytes(StandardCharsets.UTF_8);

    GenerationJob completed =
        transactionService.completeAnalysis(
            job.getJobId(),
            () -> {
              analysisMaterializer.materialize(job, payload);
              persistAnalysisRun(job, request, result, local);
            });
    if (completed.getStatus()
        != com.narrativex.backend.feature.generation.domain.enums.JobStatus.COMPLETED) {
      return;
    }

    log.info(
        "Chapter analysis successfully completed for job {} using model {} (tokens: prompt={}, thinking={}, output={}, total={})",
        job.getJobId(),
        result.model(),
        result.usage().promptTokens(),
        result.usage().thinkingTokens(),
        result.usage().outputTokens(),
        result.usage().totalTokens());
  }

  private void persistAnalysisRun(
      GenerationJob job,
      ChapterAnalysisRequest request,
      ChapterAnalysisResult result,
      LocalProvenance local) {
    if (analysisRunRepository == null) {
      return;
    }
    String sourceHash = job.getSourceHash();
    if (sourceHash == null || sourceHash.isBlank()) {
      sourceHash =
          CanonHashCalculator.sha256(job.getSourceText() != null ? job.getSourceText() : "");
    }
    UUID storyboardRevisionId = job.getStoryboardRevisionId();
    if (storyboardRevisionId == null && chapterMapper != null) {
      ChapterRow chapter = chapterMapper.findById(job.getChapterId());
      if (chapter != null) {
        storyboardRevisionId = chapter.getCurrentStoryboardRevisionId();
      }
    }
    ChapterAnalysisUsage usage = result.usage();
    ChapterAnalysisRun run =
        new ChapterAnalysisRun(
            null,
            job.getId(),
            job.getChapterId(),
            storyboardRevisionId,
            sourceHash,
            result.model(),
            request.promptVersion() != null ? request.promptVersion() : "1.0",
            request.schemaVersion() != null ? request.schemaVersion() : "1.0",
            usage.promptTokens(),
            usage.outputTokens(),
            usage.thinkingTokens(),
            usage.cachedTokens(),
            usage.totalTokens(),
            usage.runtimeMs(),
            result.canonHash(),
            Instant.now(),
            usage.usageState(),
            local.executionMode(),
            local.attemptId(),
            local.credentialRef(),
            local.adapterVersion(),
            local.conversationId(),
            null,
            null,
            result.promptHash(),
            result.schemaHash(),
            CanonHashCalculator.sha256(result.rawJson()));
    analysisRunRepository.recordRun(run);
  }
}
