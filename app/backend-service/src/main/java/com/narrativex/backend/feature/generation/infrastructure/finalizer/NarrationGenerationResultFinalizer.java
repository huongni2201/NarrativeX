package com.narrativex.backend.feature.generation.infrastructure.finalizer;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizer;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finalizes narration generation jobs upon compute success (callback or reconciliation).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NarrationGenerationResultFinalizer implements ComputeResultFinalizer {
  private final GenerationJobRepository generationJobRepository;
  private final MediaAssetRepository mediaAssetRepository;
  private final ComputeArtifactAccess artifactAccess;

  @Override
  public JobType supportedType() {
    return JobType.NARRATION_GENERATE;
  }

  @Override
  @Transactional
  public void finalizeResult(GenerationJob job, ComputeObservationDto observation) {
    if (job.getStatus().isTerminal()) {
      log.debug(
          "Job {} is already terminal ({}), skipping finalization", job.getJobId(), job.getStatus());
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
                        && "narration".equalsIgnoreCase(artifact.role())
                        && "audio/wav".equalsIgnoreCase(artifact.mediaType()))
            .findFirst()
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        "Compute observation is missing required narration output"));

    OutputArtifactTargetDto target =
        artifactAccess.getOrCreateTarget(
            taskId, attemptId, produced.artifactId(), produced.role(), produced.mediaType());

    artifactAccess.verifyOutput(target, produced);

    mediaAssetRepository.createGeneratedAsset(
        new MediaAssetRepository.CreateGeneratedMediaAsset(
            produced.artifactId(),
            job.getProjectId(),
            "AUDIO",
            "TTS_GENERATED",
            artifactAccess.storageKey(target),
            job.getJobId() + ".wav",
            produced.mediaType(),
            produced.sizeBytes(),
            produced.sha256(),
            null));

    GenerationJob freshJob =
        generationJobRepository.findByJobId(job.getJobId()).orElse(job);
    if (!freshJob.getStatus().isTerminal()) {
      GenerationJob completed = freshJob.markCompleted("NARRATION_READY");
      generationJobRepository.save(completed);
      log.info("Narration generation completed and asset finalized for job {}", job.getJobId());
    }
  }
}
