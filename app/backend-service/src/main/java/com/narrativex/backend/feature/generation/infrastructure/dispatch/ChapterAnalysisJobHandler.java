package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.model.analysis.CanonHashCalculator;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisProvider;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisProviderId;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.analysis.vertex.DisabledChapterAnalysisProvider;
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
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Handler for CHAPTER_ANALYZE generation jobs. Enforces that the Vertex Gemini AI call executes
 * outside any database transaction.
 */
@Slf4j
@Component
public class ChapterAnalysisJobHandler implements GenerationJobHandler {
  private final GenerationJobRepository generationJobRepository;
  private final GenerationJobTransactionService transactionService;
  private final ChapterAnalysisProvider chapterAnalysisProvider;
  private final ChapterAnalysisArtifactMaterializer analysisMaterializer;
  private final ChapterAnalysisRunRepository analysisRunRepository;
  private final ChapterMapper chapterMapper;

  @Autowired(required = false)
  private com.narrativex.backend.feature.generation.application.port.out
          .ChapterAnalysisExecutionStore
      localExecutions;

  @Autowired(required = false)
  private com.narrativex.backend.feature.generation.application.port.out
          .ChapterAnalysisPromptSnapshotRepository
      promptSnapshots;

  @Autowired
  public ChapterAnalysisJobHandler(
      GenerationJobRepository generationJobRepository,
      GenerationJobTransactionService transactionService,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      @Autowired(required = false) ChapterAnalysisProvider chapterAnalysisProvider,
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
    this.chapterAnalysisProvider =
        chapterAnalysisProvider != null
            ? chapterAnalysisProvider
            : new DisabledChapterAnalysisProvider();
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
      ChapterAnalysisProvider chapterAnalysisProvider,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService,
      ChapterAnalysisRunRepository analysisRunRepository) {
    this(
        generationJobRepository,
        transactionService,
        storyboardMapper,
        chapterMapper,
        chapterAnalysisProvider,
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
  public void execute(UUID jobId) {
    if (localExecutions != null
        && generationJobRepository
            .findByJobId(jobId)
            .flatMap(j -> localExecutions.findSnapshot(j.getId()))
            .filter(
                s -> s.profile().executionMode() != ChapterAnalysisExecutionMode.VERTEX_API)
            .isPresent()) {
      return; // Electron claims this frozen job; never fall back to Vertex.
    }
    log.info("Executing chapter analysis via ChapterAnalysisJobHandler for job {}", jobId);
    Optional<GenerationJob> claimedOpt =
        transactionService.claimForRunning(jobId, "ANALYZING_STORY", 10);
    if (claimedOpt.isEmpty()) {
      return;
    }
    GenerationJob job = claimedOpt.get();

    ChapterAnalysisRequest request =
        new ChapterAnalysisRequest(
            job.getProjectId(),
            job.getChapterId(),
            job.getStoryboardRevisionId(),
            job.getSourceText(),
            job.getSourceLanguage(),
            "1.1",
            "1.1",
            null,
            null,
            frozenCustomInstruction(job));

    // Call external provider (Google Vertex Gemini 3.8 Flash) OUTSIDE of any database transaction
    ChapterAnalysisResult result;
    try {
      result = chapterAnalysisProvider.analyze(request);
    } catch (ChapterAnalysisException e) {
      log.error(
          "Chapter analysis provider failure for job {}: {}", job.getJobId(), e.getMessage(), e);
      if (e.isRetryable()) {
        transactionService.markSubmissionUnknown(
            job.getJobId(),
            "COMPUTE_OUTCOME_UNKNOWN",
            e.getMessage(),
            Instant.now().plusSeconds(15));
      } else {
        transactionService.markSubmissionFailed(
            job.getJobId(), "CHAPTER_ANALYSIS_FAILED", e.getMessage());
      }
      return;
    } catch (RuntimeException e) {
      log.error("Exception during chapter analysis external call for job {}", job.getJobId(), e);
      transactionService.markSubmissionFailed(
          job.getJobId(), "CHAPTER_ANALYSIS_FAILED", "Failed to analyze chapter");
      return;
    }

    // Materialize results in a short database transaction
    try {
      materializeAndComplete(job, request, result);
    } catch (RuntimeException e) {
      log.error("Failed to materialize chapter analysis for job {}", job.getJobId(), e);
      transactionService.markSubmissionFailed(
          job.getJobId(), "CHAPTER_ANALYSIS_FAILED", "Failed to materialize chapter analysis");
    }
  }

  /** The editorial instruction frozen at admission; never the current configuration. */
  private String frozenCustomInstruction(GenerationJob job) {
    if (promptSnapshots == null) return null;
    return promptSnapshots
        .find(job.getId())
        .map(
            com.narrativex.backend.feature.generation.application.model.analysis
                    .ChapterAnalysisPromptSnapshot
                ::instruction)
        .orElse(null);
  }

  public void materializeAndComplete(
      GenerationJob job, ChapterAnalysisRequest request, ChapterAnalysisResult result) {
    materializeAndComplete(job, request, result, null);
  }

  public record LocalProvenance(
      UUID attemptId,
      UUID credentialRef,
      String cliVersion,
      String conversationId,
      ChapterAnalysisExecutionMode executionMode) {}

  public void materializeAndComplete(
      GenerationJob job,
      ChapterAnalysisRequest request,
      ChapterAnalysisResult result,
      LocalProvenance local) {
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
            local == null
                ? ChapterAnalysisProviderId.VERTEX
                : ChapterAnalysisProviderId.ANTIGRAVITY,
            local == null ? ChapterAnalysisExecutionMode.VERTEX_API : local.executionMode(),
            local == null ? null : local.attemptId(),
            local == null ? null : local.credentialRef(),
            local == null ? null : local.cliVersion(),
            local == null ? null : local.conversationId(),
            null,
            null,
            result.promptHash(),
            result.schemaHash(),
            CanonHashCalculator.sha256(result.rawJson()));
    analysisRunRepository.recordRun(run);
  }
}
