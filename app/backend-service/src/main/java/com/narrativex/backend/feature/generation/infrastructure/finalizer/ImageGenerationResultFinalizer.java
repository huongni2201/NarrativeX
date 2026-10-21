package com.narrativex.backend.feature.generation.infrastructure.finalizer;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizer;
import com.narrativex.backend.feature.generation.application.service.InvalidComputeOutputException;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Finalizes image generation jobs upon compute success (callback or reconciliation). */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImageGenerationResultFinalizer implements ComputeResultFinalizer {
  private final GenerationJobRepository generationJobRepository;
  private final MediaAssetRepository mediaAssetRepository;
  private final ComputeArtifactAccess artifactAccess;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;

  @Override
  public JobType supportedType() {
    return JobType.CHAPTER_GENERATE;
  }

  @Override
  public boolean supports(
      JobType jobType,
      com.narrativex.backend.feature.generation.domain.enums.ProductionMode productionMode) {
    return jobType == JobType.CHAPTER_GENERATE
        && (productionMode == null
            || productionMode
                == com.narrativex.backend.feature.generation.domain.enums.ProductionMode
                    .IMAGE_MOTION
            || productionMode
                == com.narrativex.backend.feature.generation.domain.enums.ProductionMode
                    .LEGACY_IMAGE);
  }

  @Override
  @Transactional(noRollbackFor = InvalidComputeOutputException.class)
  public void finalizeResult(GenerationJob job, ComputeObservationDto observation) {
    if (job.getStatus().isTerminal()) {
      log.debug(
          "Job {} is already terminal ({}), skipping finalization",
          job.getJobId(),
          job.getStatus());
      return;
    }

    UUID taskId = job.getJobId();
    UUID attemptId =
        job.getComputeAttemptId() != null
            ? job.getComputeAttemptId()
            : ComputeAttemptIdentity.forJob(job.getJobId(), job.getType());

    ProducedArtifactDto produced =
        observation.outputs().stream()
            .filter(
                artifact ->
                    artifact != null
                        && "image".equalsIgnoreCase(artifact.role())
                        && "image/png".equalsIgnoreCase(artifact.mediaType()))
            .findFirst()
            .orElseThrow(
                () ->
                    new InvalidComputeOutputException(
                        "Compute observation is missing required image output"));

    OutputArtifactTargetDto target =
        artifactAccess.getOrCreateTarget(
            taskId, attemptId, produced.artifactId(), produced.role(), produced.mediaType());

    artifactAccess.verifyOutput(target, produced);

    mediaAssetRepository.createGeneratedAsset(
        new MediaAssetRepository.CreateGeneratedMediaAsset(
            produced.artifactId(),
            job.getProjectId(),
            "IMAGE",
            "IMAGE_GENERATED",
            artifactAccess.storageKey(target),
            job.getJobId() + ".png",
            produced.mediaType(),
            produced.sizeBytes(),
            produced.sha256(),
            null));

    // Attach the asset to its VisualBeat attempt so the user can review and select it.
    mediaGenerationItemRepository.completeImageAttempt(
        requireSingleAttempt(job).getId(), produced.artifactId());

    GenerationJob freshJob = generationJobRepository.findByJobId(job.getJobId()).orElse(job);
    if (!freshJob.getStatus().isTerminal()) {
      GenerationJob completed = freshJob.markCompleted("MEDIA_READY");
      generationJobRepository.save(completed);
      log.info("Image generation completed and asset finalized for job {}", job.getJobId());
    }
  }

  private MediaGenerationItem requireSingleAttempt(GenerationJob job) {
    List<MediaGenerationItem> attempts = mediaGenerationItemRepository.findByJobId(job.getId());
    if (attempts.size() != 1) {
      throw new IllegalStateException(
          "Image job " + job.getJobId() + " must own exactly one VisualBeat attempt");
    }
    return attempts.get(0);
  }
}
