package com.narrativex.backend.feature.generation.infrastructure.dispatch;

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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Handler for CHAPTER_GENERATE (image generation) jobs. Submits task to GPU compute plane and
 * immediately records SUBMITTED without blocking.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImageGenerationJobHandler implements GenerationJobHandler {
  private static final String PROTOCOL_VERSION = "1.0";

  private final GenerationJobTransactionService transactionService;
  private final GenerationExecutionPort executionPort;
  private final ComputeArtifactAccess artifactAccess;

  @Override
  public JobType supportedType() {
    return JobType.CHAPTER_GENERATE;
  }

  @Override
  public void execute(UUID jobId) {
    log.info("Claiming image generation job {} for submission", jobId);
    Optional<GenerationJob> jobOpt =
        transactionService.claimForSubmission(jobId, "GENERATING_MEDIA");
    if (jobOpt.isEmpty()) {
      return;
    }
    GenerationJob job = jobOpt.get();

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
          "Image generation task submitted for job {}; taskId={}, attemptId={}, handle={}, nextReconcileAt={}",
          jobId,
          taskId,
          attemptId,
          receipt.executionHandle(),
          nextReconcile);
    } catch (RuntimeException e) {
      log.error("Failed to submit image generation task for job {}", jobId, e);
      if (isOutcomeAmbiguous(e)) {
        Instant nextReconcile = Instant.now().plusSeconds(2);
        transactionService.markSubmissionUnknown(
            jobId, "COMPUTE_OUTCOME_UNKNOWN", "Image dispatch outcome unknown", nextReconcile);
      } else {
        transactionService.markSubmissionFailed(
            jobId, "IMAGE_DISPATCH_ERROR", "Failed to dispatch image generation");
      }
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
