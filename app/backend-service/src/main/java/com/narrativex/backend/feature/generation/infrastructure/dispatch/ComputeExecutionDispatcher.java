package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisProvider;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.infrastructure.analysis.vertex.DisabledChapterAnalysisProvider;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeServiceProperties;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Thin dispatcher routing queued GenerationJobs to their respective JobHandlers.
 * Does NOT hold open database transactions across remote provider/compute calls.
 */
@Slf4j
@Service
public class ComputeExecutionDispatcher {

  private final GenerationJobRepository generationJobRepository;
  private final GenerationJobHandlerRegistry handlerRegistry;

  @Autowired
  public ComputeExecutionDispatcher(
      GenerationJobRepository generationJobRepository,
      GenerationJobHandlerRegistry handlerRegistry) {
    this.generationJobRepository = generationJobRepository;
    this.handlerRegistry = handlerRegistry;
  }

  // Backward-compatible constructors for legacy tests and callers
  public ComputeExecutionDispatcher(
      GenerationJobRepository generationJobRepository,
      GenerationExecutionPort executionPort,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      ComputeArtifactAccess artifactAccess,
      MediaAssetRepository mediaAssetRepository) {
    this(
        generationJobRepository,
        executionPort,
        storyboardMapper,
        chapterMapper,
        artifactAccess,
        mediaAssetRepository,
        new DisabledChapterAnalysisProvider());
  }

  public ComputeExecutionDispatcher(
      GenerationJobRepository generationJobRepository,
      GenerationExecutionPort executionPort,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      ComputeArtifactAccess artifactAccess,
      MediaAssetRepository mediaAssetRepository,
      ChapterAnalysisProvider chapterAnalysisProvider) {
    this(
        generationJobRepository,
        executionPort,
        storyboardMapper,
        chapterMapper,
        artifactAccess,
        mediaAssetRepository,
        chapterAnalysisProvider,
        null,
        null,
        null);
  }

  public ComputeExecutionDispatcher(
      GenerationJobRepository generationJobRepository,
      GenerationExecutionPort executionPort,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      ComputeArtifactAccess artifactAccess,
      MediaAssetRepository mediaAssetRepository,
      ChapterAnalysisProvider chapterAnalysisProvider,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService) {
    this(
        generationJobRepository,
        executionPort,
        storyboardMapper,
        chapterMapper,
        artifactAccess,
        mediaAssetRepository,
        chapterAnalysisProvider,
        canonMapper,
        canonReconciliationService,
        null);
  }

  public ComputeExecutionDispatcher(
      GenerationJobRepository generationJobRepository,
      GenerationExecutionPort executionPort,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      ComputeArtifactAccess artifactAccess,
      MediaAssetRepository mediaAssetRepository,
      ChapterAnalysisProvider chapterAnalysisProvider,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService,
      ChapterAnalysisRunRepository analysisRunRepository) {
    this.generationJobRepository = generationJobRepository;

    GenerationJobTransactionService transactionService =
        new GenerationJobTransactionService(generationJobRepository);
    ChapterAnalysisJobHandler analysisHandler =
        new ChapterAnalysisJobHandler(
            generationJobRepository,
            transactionService,
            storyboardMapper,
            chapterMapper,
            chapterAnalysisProvider,
            canonMapper,
            canonReconciliationService,
            analysisRunRepository);
    ImageGenerationJobHandler imageHandler =
        new ImageGenerationJobHandler(transactionService, executionPort, artifactAccess);
    NarrationGenerationJobHandler narrationHandler =
        new NarrationGenerationJobHandler(transactionService, executionPort, artifactAccess);

    this.handlerRegistry =
        new GenerationJobHandlerRegistry(List.of(analysisHandler, imageHandler, narrationHandler));
  }

  public ComputeExecutionDispatcher(
      GenerationJobRepository generationJobRepository,
      GenerationExecutionPort executionPort,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      ComputeServiceProperties properties,
      ComputeArtifactAccess artifactAccess,
      MediaAssetRepository mediaAssetRepository,
      ChapterAnalysisProvider chapterAnalysisProvider,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService,
      ChapterAnalysisRunRepository analysisRunRepository) {
    this(
        generationJobRepository,
        executionPort,
        storyboardMapper,
        chapterMapper,
        artifactAccess,
        mediaAssetRepository,
        chapterAnalysisProvider,
        canonMapper,
        canonReconciliationService,
        analysisRunRepository);
  }

  /**
   * Dispatches a queued generation job to its designated handler.
   * Execution happens asynchronously or with short per-step transactions.
   */
  public void dispatchJob(UUID jobId) {
    Optional<GenerationJob> jobOpt = generationJobRepository.findByJobId(jobId);
    if (jobOpt.isEmpty()) {
      log.debug("Job {} not found for execution dispatch", jobId);
      return;
    }

    GenerationJob job = jobOpt.get();
    if (job.getStatus() != JobStatus.QUEUED) {
      log.debug(
          "Job {} is not in QUEUED state (current: {}), skipping dispatch", jobId, job.getStatus());
      return;
    }

    Optional<GenerationJobHandler> handlerOpt = handlerRegistry.findHandler(job.getType());
    if (handlerOpt.isPresent()) {
      handlerOpt.get().execute(jobId);
    } else {
      log.debug(
          "Job {} with type {} does not require compute service dispatch", jobId, job.getType());
    }
  }
}
