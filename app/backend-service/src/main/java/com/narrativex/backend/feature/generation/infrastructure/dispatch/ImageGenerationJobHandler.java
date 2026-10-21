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
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeClientException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Handler for CHAPTER_GENERATE (image generation) jobs. Submits the frozen VisualBeat prompt of the
 * job's single image attempt to the GPU compute plane and immediately records SUBMITTED without
 * blocking.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImageGenerationJobHandler implements GenerationJobHandler {
  private static final String PROTOCOL_VERSION = "1.0";
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final GenerationJobTransactionService transactionService;
  private final GenerationExecutionPort executionPort;
  private final ComputeArtifactAccess artifactAccess;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;
  private final MediaPlanRepository mediaPlanRepository;

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

    List<MediaGenerationItem> items = mediaGenerationItemRepository.findByJobId(job.getId());
    if (items.size() != 1) {
      transactionService.markSubmissionFailed(
          jobId, "IMAGE_SCOPE_UNSUPPORTED", "An image job must target exactly one VisualBeat.");
      return;
    }
    UUID visualBeatId = items.get(0).getVisualBeatId();
    Optional<MediaPlanRepository.FrozenBeatImageInput> frozen =
        mediaPlanRepository.findFrozenBeatImageInput(job.getMediaPlanId(), visualBeatId);
    if (frozen.isEmpty()) {
      transactionService.markSubmissionFailed(
          jobId,
          "IMAGE_INPUT_MISSING",
          "The frozen prompt for this VisualBeat image attempt was not found.");
      return;
    }
    Map<String, Object> inputs;
    try {
      inputs = imageInputs(taskId, visualBeatId, frozen.get());
    } catch (RuntimeException exception) {
      log.error("Frozen image input is invalid for job {}", jobId, exception);
      transactionService.markSubmissionFailed(
          jobId, "IMAGE_INPUT_INVALID", "The frozen VisualBeat image input is invalid.");
      return;
    }

    TaskDescriptorDto task = new TaskDescriptorDto("image.generate", "1.0");
    ModelRefDto model = new ModelRefDto("comfyui", "realvisxl", "5.0");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
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

  /** Task inputs come only from the frozen plan snapshot; the seed is fixed per job and VisualBeat. */
  private static Map<String, Object> imageInputs(
      UUID jobId, UUID visualBeatId, MediaPlanRepository.FrozenBeatImageInput frozen) {
    int[] size = dimensionsFor(aspectRatioOf(frozen.imageSettingsJson()));
    return Map.of(
        "prompt",
        frozen.prompt(),
        "negativePrompt",
        Objects.requireNonNullElse(frozen.negativePrompt(), ""),
        "width",
        size[0],
        "height",
        size[1],
        "seed",
        seedFor(jobId, visualBeatId));
  }

  @SuppressWarnings("unchecked")
  private static String aspectRatioOf(String imageSettingsJson) {
    Map<String, Object> settings = JSON.readValue(imageSettingsJson, Map.class);
    return (String) settings.get("aspectRatio");
  }

  /** Sizes suited to the image model for each supported project aspect ratio. */
  private static int[] dimensionsFor(String aspectRatio) {
    return switch (aspectRatio) {
      case "16:9" -> new int[] {1344, 768};
      case "9:16" -> new int[] {768, 1344};
      case "4:3" -> new int[] {1152, 896};
      case "3:4" -> new int[] {896, 1152};
      case "1:1" -> new int[] {1024, 1024};
      default -> throw new IllegalArgumentException("Unsupported aspect ratio: " + aspectRatio);
    };
  }

  private static int seedFor(UUID jobId, UUID visualBeatId) {
    int seed = Math.floorMod(Objects.hash(jobId, visualBeatId, "image-seed"), Integer.MAX_VALUE);
    return seed == 0 ? 1 : seed;
  }

  private boolean isOutcomeAmbiguous(RuntimeException exception) {
    if (exception instanceof ComputeClientException computeException) {
      int statusCode = computeException.getStatusCode();
      return statusCode == 0 || statusCode >= 500;
    }
    return true;
  }
}
