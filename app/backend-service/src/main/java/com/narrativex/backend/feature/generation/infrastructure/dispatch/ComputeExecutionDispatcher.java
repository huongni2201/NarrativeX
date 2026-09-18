package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.model.analysis.CanonHashCalculator;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisProvider;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.analysis.vertex.DisabledChapterAnalysisProvider;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeClientException;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeObservationReconciler;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeServiceProperties;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardRevisionRow;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class ComputeExecutionDispatcher {
  private static final String PROTOCOL_VERSION = "1.0";

  private final GenerationJobRepository generationJobRepository;
  private final GenerationExecutionPort executionPort;
  private final StoryboardMapper storyboardMapper;
  private final ChapterMapper chapterMapper;
  private final ComputeArtifactAccess artifactAccess;
  private final MediaAssetRepository mediaAssetRepository;
  private final ComputeObservationReconciler observationReconciler;
  private final ChapterAnalysisArtifactMaterializer analysisMaterializer;
  private final ChapterAnalysisProvider chapterAnalysisProvider;
  private final ChapterAnalysisRunRepository analysisRunRepository;

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
    this.executionPort = executionPort;
    this.storyboardMapper = storyboardMapper;
    this.chapterMapper = chapterMapper;
    this.artifactAccess = artifactAccess;
    this.mediaAssetRepository = mediaAssetRepository;
    this.chapterAnalysisProvider = chapterAnalysisProvider;
    this.analysisRunRepository = analysisRunRepository;
    this.analysisMaterializer =
        new ChapterAnalysisArtifactMaterializer(
            storyboardMapper,
            chapterMapper,
            new SourceAnchorResolver(),
            canonMapper,
            canonReconciliationService);
    this.observationReconciler =
        new ComputeObservationReconciler(
            executionPort, Duration.ofSeconds(30), Duration.ofMillis(250));
  }

  @Autowired
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
      @Autowired(required = false) ChapterAnalysisRunRepository analysisRunRepository) {
    this.generationJobRepository = generationJobRepository;
    this.executionPort = executionPort;
    this.storyboardMapper = storyboardMapper;
    this.chapterMapper = chapterMapper;
    this.artifactAccess = artifactAccess;
    this.mediaAssetRepository = mediaAssetRepository;
    this.chapterAnalysisProvider = chapterAnalysisProvider;
    this.analysisRunRepository = analysisRunRepository;
    this.analysisMaterializer =
        new ChapterAnalysisArtifactMaterializer(
            storyboardMapper,
            chapterMapper,
            new SourceAnchorResolver(),
            canonMapper,
            canonReconciliationService);
    this.observationReconciler =
        new ComputeObservationReconciler(
            executionPort,
            properties.getReconciliationTimeout(),
            properties.getReconciliationPollInterval());
  }

  @Transactional
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

    if (job.getType() == JobType.CHAPTER_ANALYZE) {
      handleChapterAnalysis(job);
    } else if (job.getType() == JobType.CHAPTER_GENERATE) {
      handleChapterGenerate(job);
    } else if (job.getType() == JobType.NARRATION_GENERATE) {
      handleNarrationGenerate(job);
    } else {
      log.debug(
          "Job {} with type {} does not require compute service dispatch", jobId, job.getType());
    }
  }

  private void handleChapterAnalysis(GenerationJob job) {
    log.info("Executing chapter analysis via ChapterAnalysisProvider for job {}", job.getJobId());
    job = job.markRunning("ANALYZING_STORY", 10);
    generationJobRepository.save(job);

    ChapterAnalysisRequest request =
        new ChapterAnalysisRequest(
            job.getProjectId(),
            job.getChapterId(),
            job.getStoryboardRevisionId(),
            job.getSourceText(),
            job.getSourceLanguage(),
            "1.0",
            "1.0",
            null,
            null);

    try {
      ChapterAnalysisResult result = chapterAnalysisProvider.analyze(request);
      byte[] payload = result.rawJson().getBytes(StandardCharsets.UTF_8);

      // Strict validation and materialization into PostgreSQL
      analysisMaterializer.materialize(job, payload);

      // Persist durable chapter analysis telemetry and provenance (ADR-0022)
      persistAnalysisRun(job, request, result);

      job = job.markCompleted("STORYBOARD_READY");
      generationJobRepository.save(job);
      log.info(
          "Chapter analysis successfully completed for job {} using model {} (tokens: prompt={}, thinking={}, output={}, total={})",
          job.getJobId(),
          result.model(),
          result.usage().promptTokens(),
          result.usage().thinkingTokens(),
          result.usage().outputTokens(),
          result.usage().totalTokens());
    } catch (ChapterAnalysisException e) {
      log.error(
          "Chapter analysis provider failure for job {}: {}", job.getJobId(), e.getMessage(), e);
      if (e.isRetryable()) {
        job = job.markUnknown("COMPUTE_OUTCOME_UNKNOWN", e.getMessage());
      } else {
        job = job.markFailed("CHAPTER_ANALYSIS_FAILED", e.getMessage());
      }
      generationJobRepository.save(job);
    } catch (RuntimeException e) {
      log.error("Exception during chapter analysis for job {}", job.getJobId(), e);
      job = job.markFailed("CHAPTER_ANALYSIS_FAILED", "Failed to analyze chapter");
      generationJobRepository.save(job);
    }
  }

  private void persistAnalysisRun(
      GenerationJob job, ChapterAnalysisRequest request, ChapterAnalysisResult result) {
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
    ChapterAnalysisUsage usage =
        result.usage() != null ? result.usage() : ChapterAnalysisUsage.zero();
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
            Instant.now());
    analysisRunRepository.recordRun(run);
  }

  private void handleChapterGenerate(GenerationJob job) {
    log.info("Dispatching image generation for job {}", job.getJobId());
    job = job.markRunning("GENERATING_MEDIA", 10);
    generationJobRepository.save(job);

    UUID taskId = job.getJobId();
    UUID attemptId = ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());
    String idempotencyKey = "compute:image-gen:" + taskId;

    TaskDescriptorDto task = new TaskDescriptorDto("image.generate", "1.0");
    ModelRefDto model = new ModelRefDto("comfyui", "realvisxl", "5.0");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "prompt",
            "cinematic photograph, high quality",
            "negativePrompt",
            "blurry, low quality, distorted",
            "width",
            1024,
            "height",
            1024,
            "seed",
            42);
    OutputArtifactTargetDto output =
        artifactAccess.createOutput(taskId, attemptId, "image", "image/png");
    TaskArtifactsDto artifacts =
        new TaskArtifactsDto(java.util.List.of(), java.util.List.of(output));

    String fingerprint =
        CanonicalFingerprintCalculator.calculateFingerprint(
            PROTOCOL_VERSION, task, model, constraints, inputs, artifacts);

    ComputeTaskRequest request =
        new ComputeTaskRequest(
            PROTOCOL_VERSION,
            taskId,
            attemptId,
            idempotencyKey,
            fingerprint,
            task,
            model,
            constraints,
            inputs,
            artifacts);

    try {
      executionPort.submitTask(request);
      ComputeObservationDto observation = observationReconciler.reconcile(taskId, attemptId);

      if (observation == null) {
        job = job.markUnknown("COMPUTE_OUTCOME_UNKNOWN", "Image outcome is not confirmed");
        generationJobRepository.save(job);
        return;
      }
      if (observation.isCanceled()) {
        job = job.markCanceled("COMPUTE_CANCELED", "Image generation canceled on compute plane");
        generationJobRepository.save(job);
        return;
      }
      if (observation.isFailed()) {
        log.warn("Image generation failed on compute service for job {}", job.getJobId());
        job = job.markFailed("IMAGE_GENERATION_FAILED", "Image generation failed on compute plane");
        generationJobRepository.save(job);
        return;
      }

      ProducedArtifactDto produced = verifyProducedOutput(observation, output);
      mediaAssetRepository.createGeneratedAsset(
          new MediaAssetRepository.CreateGeneratedMediaAsset(
              output.artifactId(),
              job.getProjectId(),
              "IMAGE",
              "IMAGE_GENERATED",
              artifactAccess.storageKey(output),
              job.getJobId() + ".png",
              output.mediaType(),
              produced.sizeBytes(),
              produced.sha256(),
              null));
      job = job.markCompleted("MEDIA_READY");
      generationJobRepository.save(job);
      log.info("Image generation completed for job {}", job.getJobId());
    } catch (RuntimeException e) {
      log.error("Exception during image generation dispatch for job {}", job.getJobId(), e);
      job = dispatchFailure(job, e, "IMAGE_DISPATCH_ERROR", "Failed to dispatch image generation");
      generationJobRepository.save(job);
    }
  }

  private void handleNarrationGenerate(GenerationJob job) {
    log.info("Dispatching narration generation for job {}", job.getJobId());
    job = job.markRunning("GENERATING_NARRATION", 10);
    generationJobRepository.save(job);

    UUID taskId = job.getJobId();
    UUID attemptId = ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());
    String idempotencyKey = "compute:tts:" + taskId;

    TaskDescriptorDto task = new TaskDescriptorDto("audio.synthesize", "1.0");
    ModelRefDto model = new ModelRefDto("vieneu", "vieneu-v3-turbo", "default");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "script", job.getSourceText() != null ? job.getSourceText() : "",
            "voice", Map.of("kind", "catalog", "value", "vieneu-default"),
            "format", Map.of("container", "wav", "sampleRateHz", 48000, "channels", 1));
    OutputArtifactTargetDto output =
        artifactAccess.createOutput(taskId, attemptId, "narration", "audio/wav");
    TaskArtifactsDto artifacts =
        new TaskArtifactsDto(java.util.List.of(), java.util.List.of(output));

    String fingerprint =
        CanonicalFingerprintCalculator.calculateFingerprint(
            PROTOCOL_VERSION, task, model, constraints, inputs, artifacts);

    ComputeTaskRequest request =
        new ComputeTaskRequest(
            PROTOCOL_VERSION,
            taskId,
            attemptId,
            idempotencyKey,
            fingerprint,
            task,
            model,
            constraints,
            inputs,
            artifacts);

    try {
      executionPort.submitTask(request);
      ComputeObservationDto observation = observationReconciler.reconcile(taskId, attemptId);

      if (observation == null) {
        job = job.markUnknown("COMPUTE_OUTCOME_UNKNOWN", "Narration outcome is not confirmed");
        generationJobRepository.save(job);
        return;
      }
      if (observation.isCanceled()) {
        job = job.markCanceled("COMPUTE_CANCELED", "Narration canceled on compute plane");
        generationJobRepository.save(job);
        return;
      }
      if (observation.isFailed()) {
        log.warn("Narration synthesis failed on compute service for job {}", job.getJobId());
        job = job.markFailed("NARRATION_FAILED", "Narration synthesis failed on compute plane");
        generationJobRepository.save(job);
        return;
      }

      ProducedArtifactDto produced = verifyProducedOutput(observation, output);
      mediaAssetRepository.createGeneratedAsset(
          new MediaAssetRepository.CreateGeneratedMediaAsset(
              output.artifactId(),
              job.getProjectId(),
              "AUDIO",
              "TTS_GENERATED",
              artifactAccess.storageKey(output),
              job.getJobId() + ".wav",
              output.mediaType(),
              produced.sizeBytes(),
              produced.sha256(),
              null));
      job = job.markCompleted("NARRATION_READY");
      generationJobRepository.save(job);
      log.info("Narration generation completed for job {}", job.getJobId());
    } catch (RuntimeException e) {
      log.error("Exception during narration dispatch for job {}", job.getJobId(), e);
      job = dispatchFailure(job, e, "NARRATION_DISPATCH_ERROR", "Failed to dispatch narration");
      generationJobRepository.save(job);
    }
  }

  private GenerationJob dispatchFailure(
      GenerationJob job, RuntimeException exception, String failureCode, String failureStep) {
    if (isOutcomeAmbiguous(exception)) {
      log.warn("Compute outcome is ambiguous for job {}; retaining UNKNOWN state", job.getJobId());
      return job.markUnknown("COMPUTE_OUTCOME_UNKNOWN", failureStep);
    }
    return job.markFailed(failureCode, failureStep);
  }

  private boolean isOutcomeAmbiguous(RuntimeException exception) {
    if (exception instanceof ComputeClientException computeException) {
      int statusCode = computeException.getStatusCode();
      return statusCode == 0 || statusCode >= 500;
    }
    // A generic runtime failure does not tell us whether the outbound request crossed the wire.
    return true;
  }

  private ProducedArtifactDto verifyProducedOutput(
      ComputeObservationDto observation, OutputArtifactTargetDto target) {
    if (observation == null || !observation.isSucceeded()) {
      throw new IllegalArgumentException("Compute output can only be verified after success");
    }
    ProducedArtifactDto produced =
        observation.outputs().stream()
            .filter(
                artifact ->
                    artifact != null
                        && target.artifactId().equals(artifact.artifactId())
                        && target.role().equals(artifact.role())
                        && target.mediaType().equals(artifact.mediaType()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Compute output is missing"));
    artifactAccess.verifyOutput(target, produced);
    return produced;
  }
}
