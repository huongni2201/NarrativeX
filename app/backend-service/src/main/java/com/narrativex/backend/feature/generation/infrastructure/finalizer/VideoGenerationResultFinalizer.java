package com.narrativex.backend.feature.generation.infrastructure.finalizer;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizer;
import com.narrativex.backend.feature.generation.application.service.VideoQualityAssurance;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeRow;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Finalizes video generation jobs upon compute success (callback or reconciliation). Materializes
 * VIDEO MediaAsset with video/mp4 MIME type, binds output to Take, performs technical validation
 * and VideoQualityAssurance evaluation, and updates Take and job state accordingly.
 */
@Slf4j
@Component
public class VideoGenerationResultFinalizer implements ComputeResultFinalizer {
  private final GenerationJobRepository generationJobRepository;
  private final MediaAssetRepository mediaAssetRepository;
  private final ComputeArtifactAccess artifactAccess;
  private final TakeMapper takeMapper;
  private final VideoQualityAssurance videoQualityAssurance;
  private final com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis
          .ShotMapper
      shotMapper;
  private final com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis
          .SelectedTakeMapper
      selectedTakeMapper;

  @Autowired
  public VideoGenerationResultFinalizer(
      GenerationJobRepository generationJobRepository,
      MediaAssetRepository mediaAssetRepository,
      ComputeArtifactAccess artifactAccess,
      TakeMapper takeMapper,
      VideoQualityAssurance videoQualityAssurance,
      @Autowired(required = false)
          com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper
              shotMapper,
      @Autowired(required = false)
          com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis
                  .SelectedTakeMapper
              selectedTakeMapper) {
    this.generationJobRepository = generationJobRepository;
    this.mediaAssetRepository = mediaAssetRepository;
    this.artifactAccess = artifactAccess;
    this.takeMapper = takeMapper;
    this.videoQualityAssurance = videoQualityAssurance;
    this.shotMapper = shotMapper;
    this.selectedTakeMapper = selectedTakeMapper;
  }

  public VideoGenerationResultFinalizer(
      GenerationJobRepository generationJobRepository,
      MediaAssetRepository mediaAssetRepository,
      ComputeArtifactAccess artifactAccess,
      TakeMapper takeMapper,
      VideoQualityAssurance videoQualityAssurance,
      com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper
          shotMapper) {
    this(
        generationJobRepository,
        mediaAssetRepository,
        artifactAccess,
        takeMapper,
        videoQualityAssurance,
        shotMapper,
        null);
  }

  // Backward-compatible constructor for existing tests
  public VideoGenerationResultFinalizer(
      GenerationJobRepository generationJobRepository,
      MediaAssetRepository mediaAssetRepository,
      ComputeArtifactAccess artifactAccess,
      TakeMapper takeMapper,
      VideoQualityAssurance videoQualityAssurance) {
    this(
        generationJobRepository,
        mediaAssetRepository,
        artifactAccess,
        takeMapper,
        videoQualityAssurance,
        null);
  }

  // Backward-compatible constructor for existing tests
  public VideoGenerationResultFinalizer(
      GenerationJobRepository generationJobRepository,
      MediaAssetRepository mediaAssetRepository,
      ComputeArtifactAccess artifactAccess) {
    this(generationJobRepository, mediaAssetRepository, artifactAccess, null, null, null);
  }

  @Override
  public JobType supportedType() {
    return JobType.CHAPTER_GENERATE;
  }

  @Override
  public boolean supports(
      JobType jobType,
      com.narrativex.backend.feature.generation.domain.enums.ProductionMode productionMode) {
    return jobType == JobType.CHAPTER_GENERATE
        && productionMode
            == com.narrativex.backend.feature.generation.domain.enums.ProductionMode.VIDEO_FIRST;
  }

  @Override
  @Transactional
  public void finalizeResult(GenerationJob job, ComputeObservationDto observation) {
    if (job.getStatus().isTerminal()) {
      log.debug(
          "Job {} is already terminal ({}), skipping video finalization",
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
                        && "video".equalsIgnoreCase(artifact.role())
                        && "video/mp4".equalsIgnoreCase(artifact.mediaType()))
            .findFirst()
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        "Compute observation is missing required video output"));

    OutputArtifactTargetDto target =
        artifactAccess.getOrCreateTarget(
            taskId, attemptId, produced.artifactId(), produced.role(), produced.mediaType());

    artifactAccess.verifyOutput(target, produced);

    mediaAssetRepository.createGeneratedAsset(
        new MediaAssetRepository.CreateGeneratedMediaAsset(
            produced.artifactId(),
            job.getProjectId(),
            "VIDEO",
            "VIDEO_GENERATED",
            artifactAccess.storageKey(target),
            job.getJobId() + ".mp4",
            produced.mediaType(),
            produced.sizeBytes(),
            produced.sha256(),
            null));

    // Update associated Take records with output asset and VideoQA validation
    if (takeMapper != null) {
      List<TakeRow> takes = takeMapper.findByJobId(job.getJobId().toString());
      if (takes.isEmpty()) {
        TakeRow byTaskId = takeMapper.findByTaskId(taskId.toString());
        if (byTaskId != null) {
          takes = List.of(byTaskId);
        }
      }

      for (TakeRow take : takes) {
        take.setOutputAssetId(produced.artifactId());
        take.setStatus("VALIDATING");
        take.setValidationStatus("VALIDATING");

        // Technical validation
        VideoQAFailureCategory detectedFailure = null;
        String failureReason = null;
        if (produced.sizeBytes() <= 0) {
          detectedFailure = VideoQAFailureCategory.TECHNICAL_OUTPUT;
          failureReason = "Generated video output is empty (0 bytes)";
        } else if (!"video/mp4".equalsIgnoreCase(produced.mediaType())) {
          detectedFailure = VideoQAFailureCategory.TECHNICAL_OUTPUT;
          failureReason = "Invalid video media type: " + produced.mediaType();
        }

        GenerationStrategy strategy = GenerationStrategy.TEXT_TO_VIDEO;
        if (take.getGenerationMode() != null) {
          try {
            strategy = GenerationStrategy.valueOf(take.getGenerationMode());
          } catch (Exception ignored) {
          }
        }

        VideoQualityAssurance.QAEvaluation qa =
            videoQualityAssurance != null
                ? videoQualityAssurance.evaluateTake(
                    take.getAttemptNumber(), strategy, detectedFailure, failureReason)
                : new VideoQualityAssurance.QAEvaluation(
                    detectedFailure == null, detectedFailure, failureReason, null, false);

        if (qa.passed()) {
          take.setStatus("PASSED");
          take.setValidationStatus("PASSED");
          take.setValidationFailureCategory(null);
          take.setValidationFailureReason(null);
          take.setValidationRetryRecommendation(null);

          if (selectedTakeMapper != null && take.getShotId() != null) {
            com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis
                    .SelectedTakeRow
                existing = selectedTakeMapper.findByShotId(take.getShotId());
            if (existing == null) {
              long duration =
                  take.getSourceDurationMs() != null && take.getSourceDurationMs() > 0
                      ? take.getSourceDurationMs()
                      : 4000L;
              com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis
                      .SelectedTakeRow
                  newSelection =
                      new com.narrativex.backend.feature.generation.infrastructure.persistence
                          .mybatis.SelectedTakeRow();
              newSelection.setShotId(take.getShotId());
              newSelection.setTakeId(take.getId());
              newSelection.setSourceInMs(0L);
              newSelection.setSourceOutMs(duration);
              newSelection.setCreatedAt(java.time.Instant.now());
              newSelection.setUpdatedAt(java.time.Instant.now());
              selectedTakeMapper.insert(newSelection);
              if (shotMapper != null) {
                shotMapper.updateStatus(take.getShotId(), "SELECTED");
              }
              log.info(
                  "Auto-selected first PASSED take {} for shot {}",
                  take.getId(),
                  take.getShotId());
            }
          }
        } else {
          take.setStatus("FAILED");
          take.setValidationStatus("FAILED");
          take.setValidationFailureCategory(
              qa.failureCategory() != null ? qa.failureCategory().name() : null);
          take.setValidationFailureReason(qa.failureReason());
          take.setValidationRetryRecommendation(qa.retryRecommendation());
        }

        takeMapper.updateValidation(take);
        takeMapper.updateStatus(take.getId(), take.getStatus());
        log.info(
            "Take {} validated: shotId={}, attemptNumber={}, status={}, QA passed={}, failureCategory={}",
            take.getId(),
            take.getShotId(),
            take.getAttemptNumber(),
            take.getStatus(),
            qa.passed(),
            take.getValidationFailureCategory());
      }
    }

    GenerationJob freshJob = generationJobRepository.findByJobId(job.getJobId()).orElse(job);
    if (!freshJob.getStatus().isTerminal()) {
      GenerationJob completed = freshJob.markCompleted("MEDIA_READY");
      generationJobRepository.save(completed);
      log.info("Video generation completed and asset finalized for job {}", job.getJobId());
    }
  }
}
