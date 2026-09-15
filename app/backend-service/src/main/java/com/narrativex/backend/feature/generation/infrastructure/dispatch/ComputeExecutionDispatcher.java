package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ComputeExecutionDispatcher {
  private static final String PROTOCOL_VERSION = "1.0";

  private final GenerationJobRepository generationJobRepository;
  private final GenerationExecutionPort executionPort;
  private final StoryboardMapper storyboardMapper;
  private final ChapterMapper chapterMapper;

  @Transactional
  public void dispatchJob(UUID jobId) {
    Optional<GenerationJob> jobOpt = generationJobRepository.findByJobId(jobId);
    if (jobOpt.isEmpty()) {
      log.debug("Job {} not found for execution dispatch", jobId);
      return;
    }

    GenerationJob job = jobOpt.get();
    if (job.getStatus() != JobStatus.QUEUED) {
      log.debug("Job {} is not in QUEUED state (current: {}), skipping dispatch", jobId, job.getStatus());
      return;
    }

    if (job.getType() == JobType.CHAPTER_ANALYZE) {
      handleChapterAnalysis(job);
    } else if (job.getType() == JobType.CHAPTER_GENERATE) {
      handleChapterGenerate(job);
    } else if (job.getType() == JobType.NARRATION_GENERATE) {
      handleNarrationGenerate(job);
    } else {
      log.debug("Job {} with type {} does not require compute service dispatch", jobId, job.getType());
    }
  }

  private void handleChapterAnalysis(GenerationJob job) {
    log.info("Dispatching chapter analysis for job {}", job.getJobId());
    job = job.markRunning("ANALYZING_STORY", 10);
    generationJobRepository.save(job);

    UUID taskId = job.getJobId();
    UUID attemptId = UuidV7.random();
    String idempotencyKey = "compute:analysis:" + taskId;

    TaskDescriptorDto task = new TaskDescriptorDto("text.generate", "1.0");
    ModelRefDto model = new ModelRefDto("qwen", "Qwen/Qwen3-8B-AWQ", "default");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "prompt", "Extract characters, locations, narrative scenes, and visual beats from the chapter source text.",
            "sourceText", job.getSourceText() != null ? job.getSourceText() : "",
            "sourceLanguage", job.getSourceLanguage() != null ? job.getSourceLanguage() : "vi");
    TaskArtifactsDto artifacts = TaskArtifactsDto.empty();

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
      ComputeObservationDto observation = executionPort.queryTask(taskId, attemptId);

      if (observation != null && observation.isFailed()) {
        log.warn("Chapter analysis failed on compute service for job {}", job.getJobId());
        job = job.markFailed("COMPUTE_SERVICE_ERROR", "Analysis failed on compute plane");
        generationJobRepository.save(job);
        return;
      }

      materializeDefaultStoryboardIfEmpty(job);
      job = job.markCompleted("STORYBOARD_READY");
      generationJobRepository.save(job);
      log.info("Chapter analysis successfully completed for job {}", job.getJobId());
    } catch (RuntimeException e) {
      log.error("Exception during chapter analysis dispatch for job {}", job.getJobId(), e);
      job = job.markFailed("COMPUTE_DISPATCH_ERROR", "Failed to dispatch analysis: " + e.getMessage());
      generationJobRepository.save(job);
    }
  }

  private void handleChapterGenerate(GenerationJob job) {
    log.info("Dispatching image generation for job {}", job.getJobId());
    job = job.markRunning("GENERATING_MEDIA", 10);
    generationJobRepository.save(job);

    UUID taskId = job.getJobId();
    UUID attemptId = UuidV7.random();
    String idempotencyKey = "compute:image-gen:" + taskId;

    TaskDescriptorDto task = new TaskDescriptorDto("image.generate", "1.0");
    ModelRefDto model = new ModelRefDto("comfyui", "realvisxl", "5.0");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "prompt", "cinematic photograph, high quality",
            "negativePrompt", "blurry, low quality, distorted",
            "width", 1024,
            "height", 1024,
            "seed", 42,
            "steps", 28,
            "cfg", 5.5,
            "sampler", "dpmpp_2m_sde",
            "scheduler", "karras");
    TaskArtifactsDto artifacts = TaskArtifactsDto.empty();

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
      ComputeObservationDto observation = executionPort.queryTask(taskId, attemptId);

      if (observation != null && observation.isFailed()) {
        log.warn("Image generation failed on compute service for job {}", job.getJobId());
        job = job.markFailed("IMAGE_GENERATION_FAILED", "Image generation failed on compute plane");
        generationJobRepository.save(job);
        return;
      }

      job = job.markCompleted("MEDIA_READY");
      generationJobRepository.save(job);
      log.info("Image generation completed for job {}", job.getJobId());
    } catch (RuntimeException e) {
      log.error("Exception during image generation dispatch for job {}", job.getJobId(), e);
      job = job.markFailed("IMAGE_DISPATCH_ERROR", "Failed to dispatch image generation: " + e.getMessage());
      generationJobRepository.save(job);
    }
  }

  private void handleNarrationGenerate(GenerationJob job) {
    log.info("Dispatching narration generation for job {}", job.getJobId());
    job = job.markRunning("GENERATING_NARRATION", 10);
    generationJobRepository.save(job);

    UUID taskId = job.getJobId();
    UUID attemptId = UuidV7.random();
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
    TaskArtifactsDto artifacts = TaskArtifactsDto.empty();

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
      ComputeObservationDto observation = executionPort.queryTask(taskId, attemptId);

      if (observation != null && observation.isFailed()) {
        log.warn("Narration synthesis failed on compute service for job {}", job.getJobId());
        job = job.markFailed("NARRATION_FAILED", "Narration synthesis failed on compute plane");
        generationJobRepository.save(job);
        return;
      }

      job = job.markCompleted("NARRATION_READY");
      generationJobRepository.save(job);
      log.info("Narration generation completed for job {}", job.getJobId());
    } catch (RuntimeException e) {
      log.error("Exception during narration dispatch for job {}", job.getJobId(), e);
      job = job.markFailed("NARRATION_DISPATCH_ERROR", "Failed to dispatch narration: " + e.getMessage());
      generationJobRepository.save(job);
    }
  }

  private void materializeDefaultStoryboardIfEmpty(GenerationJob job) {
    if (job.getChapterId() == null || job.getStoryboardRevisionId() == null) {
      return;
    }

    var existingScenes = storyboardMapper.findCurrentScenes(job.getChapterId());
    if (existingScenes.isEmpty()) {
      SceneRow scene = new SceneRow();
      scene.setChapterId(job.getChapterId());
      scene.setStoryboardRevisionId(job.getStoryboardRevisionId());
      scene.setProjectId(job.getProjectId());
      scene.setOrderIndex(0);
      scene.setTitle("Scene 1");
      scene.setNarration(job.getSourceText() != null ? job.getSourceText() : "");
      scene.setStatus("DRAFT");
      UUID sceneId = storyboardMapper.insertScene(scene);

      VisualBeatRow beat = new VisualBeatRow();
      beat.setSceneId(sceneId);
      beat.setOrderIndex(0);
      beat.setTitle("Beat 1");
      beat.setVisualIntent("Scene visual beat");
      beat.setVisualDirectionJson("{}");
      beat.setReviewStatus("NEEDS_REVIEW");
      beat.setMotionMode("STILL");
      storyboardMapper.insertVisualBeat(beat);

      ChapterRow chapter = chapterMapper.findById(job.getChapterId());
      if (chapter != null) {
        chapter.setCurrentStoryboardRevisionId(job.getStoryboardRevisionId());
        chapterMapper.update(chapter);
      }
    }
  }
}
