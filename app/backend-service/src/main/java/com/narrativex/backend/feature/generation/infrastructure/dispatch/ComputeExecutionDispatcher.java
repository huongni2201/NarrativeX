package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeClientException;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeObservationReconciler;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeServiceProperties;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
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

  public ComputeExecutionDispatcher(
      GenerationJobRepository generationJobRepository,
      GenerationExecutionPort executionPort,
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      ComputeArtifactAccess artifactAccess,
      MediaAssetRepository mediaAssetRepository) {
    this.generationJobRepository = generationJobRepository;
    this.executionPort = executionPort;
    this.storyboardMapper = storyboardMapper;
    this.chapterMapper = chapterMapper;
    this.artifactAccess = artifactAccess;
    this.mediaAssetRepository = mediaAssetRepository;
    this.analysisMaterializer =
        new ChapterAnalysisArtifactMaterializer(storyboardMapper, chapterMapper);
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
      MediaAssetRepository mediaAssetRepository) {
    this.generationJobRepository = generationJobRepository;
    this.executionPort = executionPort;
    this.storyboardMapper = storyboardMapper;
    this.chapterMapper = chapterMapper;
    this.artifactAccess = artifactAccess;
    this.mediaAssetRepository = mediaAssetRepository;
    this.analysisMaterializer =
        new ChapterAnalysisArtifactMaterializer(storyboardMapper, chapterMapper);
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
    log.info("Dispatching chapter analysis for job {}", job.getJobId());
    job = job.markRunning("ANALYZING_STORY", 10);
    generationJobRepository.save(job);

    UUID taskId = job.getJobId();
    UUID attemptId = ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());
    String idempotencyKey = "compute:analysis:" + taskId;

    TaskDescriptorDto task = new TaskDescriptorDto("text.generate", "1.0");
    ModelRefDto model = new ModelRefDto("qwen", "Qwen/Qwen3-8B-AWQ", "default");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "prompt",
            "Extract characters, locations, narrative scenes, and visual beats from this "
                + "chapter. Source language: "
                + job.getSourceLanguage()
                + "\n\n"
                + job.getSourceText(),
            "systemPrompt",
            "Return only the requested JSON document.",
            "temperature",
            0.2,
            "topP",
            0.8,
            "maxTokens",
            16384,
            "responseFormat",
            "json_object");
    OutputArtifactTargetDto output =
        artifactAccess.createOutput(taskId, attemptId, "analysis", "application/json");
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
        job = job.markUnknown("COMPUTE_OUTCOME_UNKNOWN", "Analysis outcome is not confirmed");
        generationJobRepository.save(job);
        return;
      }
      if (observation.isCanceled()) {
        job = job.markCanceled("COMPUTE_CANCELED", "Analysis canceled on compute plane");
        generationJobRepository.save(job);
        return;
      }
      if (observation.isFailed()) {
        log.warn("Chapter analysis failed on compute service for job {}", job.getJobId());
        job = job.markFailed("COMPUTE_SERVICE_ERROR", "Analysis failed on compute plane");
        generationJobRepository.save(job);
        return;
      }

      verifyProducedOutput(observation, output);
      // Analysis materialization is intentionally handled only by a validated provider payload.
      // A successful compute observation without a materializable storyboard is not success.
      materializeAnalysisOutput(job, output);
      job = job.markCompleted("STORYBOARD_READY");
      generationJobRepository.save(job);
      log.info("Chapter analysis successfully completed for job {}", job.getJobId());
    } catch (RuntimeException e) {
      log.error("Exception during chapter analysis dispatch for job {}", job.getJobId(), e);
      job = dispatchFailure(job, e, "COMPUTE_DISPATCH_ERROR", "Failed to dispatch analysis");
      generationJobRepository.save(job);
    }
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
    ModelRefDto model = new ModelRefDto("voicestudio", "vi-profile", "0.5.2");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "script", job.getSourceText() != null ? job.getSourceText() : "",
            "voice", Map.of("kind", "catalog", "value", "vi_female_01"),
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

  private void materializeAnalysisOutput(GenerationJob job, OutputArtifactTargetDto target) {
    byte[] payload = artifactAccess.readOutput(target);
    analysisMaterializer.materialize(job, payload);
  }
}
