package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.character.application.service.SpeakerVoiceResolver;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeClientException;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Handler for VIDEO_FIRST CHAPTER_GENERATE jobs using the provider-neutral video.generate workload.
 * Extracts prompt, duration, camera intent, motion intent from Shot planning, and submits task to
 * GPU compute plane.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VideoGenerationJobHandler implements GenerationJobHandler {
  private static final String PROTOCOL_VERSION = "1.0";
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final GenerationJobTransactionService transactionService;
  private final GenerationExecutionPort executionPort;
  private final ComputeArtifactAccess artifactAccess;
  private final StoryboardShotAccess storyboardShotAccess;
  private final SpeakerVoiceResolver speakerVoiceResolver;

  @Override
  public JobType supportedType() {
    return JobType.CHAPTER_GENERATE;
  }

  @Override
  public void execute(UUID jobId) {
    log.info("Claiming video generation job {} for submission", jobId);
    Optional<GenerationJob> jobOpt =
        transactionService.claimForSubmission(jobId, "GENERATING_VIDEO");
    if (jobOpt.isEmpty()) {
      return;
    }
    GenerationJob job = jobOpt.get();

    UUID taskId = job.getJobId();
    UUID attemptId = ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());
    String idempotencyKey = "compute:video-gen:" + taskId;

    TaskDescriptorDto task = new TaskDescriptorDto("video.generate", "1.0");
    ModelRefDto model = new ModelRefDto("ltx", "ltx-2.5-nvfp4", "1.0");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(20, ChronoUnit.MINUTES), 1200);

    List<StoryboardShotAccess.ShotView> shots = List.of();
    if (storyboardShotAccess != null && job.getProjectId() != null && job.getChapterId() != null) {
      try {
        shots = storyboardShotAccess.requireCurrentShots(job.getProjectId(), job.getChapterId());
      } catch (Exception e) {
        log.warn(
            "Could not retrieve current shots for chapter {}: {}",
            job.getChapterId(),
            e.getMessage());
      }
    }

    String prompt = "Cinematic video shot, high visual fidelity, seamless motion";
    int width = 1280;
    int height = 720;
    int fps = 24;
    int durationMs = 4000;
    String generationMode = "TEXT_TO_VIDEO";
    Map<String, Object> cameraIntent = null;
    Map<String, Object> motionIntent = null;

    if (!shots.isEmpty()) {
      StoryboardShotAccess.ShotView shot = shots.get(0);
      if (shot.narrativePurpose() != null && !shot.narrativePurpose().isBlank()) {
        prompt = shot.narrativePurpose().trim();
      }
      if (shot.targetDurationMs() > 0) {
        durationMs = (int) shot.targetDurationMs();
      }
      if (shot.generationStrategy() != null) {
        generationMode = shot.generationStrategy().name();
      }
      if (shot.cameraMotionJson() != null && !shot.cameraMotionJson().isBlank()) {
        cameraIntent = parseJsonMap(shot.cameraMotionJson());
      } else if (shot.cameraJson() != null && !shot.cameraJson().isBlank()) {
        cameraIntent = parseJsonMap(shot.cameraJson());
      }
      if (shot.subjectMotionJson() != null && !shot.subjectMotionJson().isBlank()) {
        motionIntent = parseJsonMap(shot.subjectMotionJson());
      }
    } else if (job.getSourceText() != null && !job.getSourceText().isBlank()) {
      prompt = job.getSourceText().trim();
    }

    Map<String, Object> inputs = new HashMap<>();
    inputs.put("prompt", prompt);
    inputs.put(
        "negativePrompt",
        "jitter, blur, flickering, morphing, low quality, deformed limbs, visual noise, text, watermark");
    inputs.put("width", width);
    inputs.put("height", height);
    inputs.put("fps", fps);
    inputs.put("durationMs", durationMs);
    inputs.put("generationMode", generationMode);
    inputs.put("seed", 42);
    if (cameraIntent != null && !cameraIntent.isEmpty()) {
      inputs.put("cameraIntent", cameraIntent);
    }
    if (motionIntent != null && !motionIntent.isEmpty()) {
      inputs.put("motionIntent", motionIntent);
    }

    OutputArtifactTargetDto output =
        artifactAccess.createOutput(taskId, attemptId, "video", "video/mp4");
    TaskArtifactsDto artifacts = new TaskArtifactsDto(List.of(), List.of(output));

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
      ComputeSubmissionReceipt receipt = executionPort.submitTask(request);
      Instant nextReconcile = Instant.now().plusSeconds(2);
      transactionService.markSubmitted(jobId, receipt, nextReconcile);
      log.info(
          "Video generation task submitted for job {}; taskId={}, attemptId={}, handle={}, nextReconcileAt={}",
          jobId,
          taskId,
          attemptId,
          receipt.executionHandle(),
          nextReconcile);
    } catch (RuntimeException e) {
      log.error("Failed to submit video generation task for job {}", jobId, e);
      if (isOutcomeAmbiguous(e)) {
        Instant nextReconcile = Instant.now().plusSeconds(2);
        transactionService.markSubmissionUnknown(
            jobId, "COMPUTE_OUTCOME_UNKNOWN", "Video dispatch outcome unknown", nextReconcile);
      } else {
        transactionService.markSubmissionFailed(
            jobId, "VIDEO_DISPATCH_ERROR", "Failed to dispatch video generation");
      }
    }
  }

  private Map<String, Object> parseJsonMap(String json) {
    if (json == null || json.isBlank() || "{}".equals(json.trim())) {
      return null;
    }
    try {
      return JSON.readValue(json, new TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      log.debug("Could not parse JSON intent map: {}", e.getMessage());
      return null;
    }
  }

  private boolean isOutcomeAmbiguous(RuntimeException exception) {
    if (exception instanceof ComputeClientException computeException) {
      int statusCode = computeException.getStatusCode();
      return statusCode == 0 || statusCode >= 500;
    }
    return true;
  }
}
