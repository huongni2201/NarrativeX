package com.narrativex.backend.feature.generation.infrastructure.finalizer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.VideoQualityAssurance;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeRow;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class VideoGenerationResultFinalizerTest {
  private GenerationJobRepository generationJobRepository;
  private MediaAssetRepository mediaAssetRepository;
  private ComputeArtifactAccess artifactAccess;
  private TakeMapper takeMapper;
  private VideoQualityAssurance videoQualityAssurance;
  private com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper shotMapper;
  private com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.SelectedTakeMapper selectedTakeMapper;
  private VideoGenerationResultFinalizer finalizer;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    mediaAssetRepository = mock(MediaAssetRepository.class);
    artifactAccess = mock(ComputeArtifactAccess.class);
    takeMapper = mock(TakeMapper.class);
    videoQualityAssurance = mock(VideoQualityAssurance.class);
    shotMapper = mock(com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper.class);
    selectedTakeMapper = mock(com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.SelectedTakeMapper.class);
    finalizer =
        new VideoGenerationResultFinalizer(
            generationJobRepository,
            mediaAssetRepository,
            artifactAccess,
            takeMapper,
            videoQualityAssurance,
            shotMapper,
            selectedTakeMapper);
  }

  @Test
  void finalizeResultSuccessfullyProcessesPassedVideo() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID artifactId = UuidV7.random();
    UUID takeId = UuidV7.random();
    UUID shotId = UuidV7.random();

    GenerationJob job =
        GenerationJob.rehydrate(
            jobId,
            0L,
            jobId,
            projectId,
            JobType.CHAPTER_GENERATE,
            JobStatus.RUNNING,
            ResourceClass.GPU_HEAVY,
            0,
            null,
            null,
            null,
            UuidV7.random(),
            null,
            1L,
            "hash",
            "Hero runs",
            "vi",
            "idemp:1",
            UuidV7.random(),
            1,
            ProductionMode.VIDEO_FIRST,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            null,
            null);

    when(generationJobRepository.findByJobId(jobId)).thenReturn(Optional.of(job));

    OutputArtifactTargetDto target =
        new OutputArtifactTargetDto(artifactId, "video", "video/mp4", null);
    when(artifactAccess.getOrCreateTarget(
            any(), any(), eq(artifactId), eq("video"), eq("video/mp4")))
        .thenReturn(target);
    when(artifactAccess.storageKey(target))
        .thenReturn("projects/" + projectId + "/assets/" + artifactId + ".mp4");

    TakeRow takeRow = new TakeRow();
    takeRow.setId(takeId);
    takeRow.setShotId(shotId);
    takeRow.setAttemptNumber(1);
    takeRow.setGenerationMode("TEXT_TO_VIDEO");
    takeRow.setStatus("RUNNING");
    when(takeMapper.findByJobId(jobId.toString())).thenReturn(List.of(takeRow));

    when(videoQualityAssurance.evaluateTake(
            eq(1), eq(GenerationStrategy.TEXT_TO_VIDEO), any(), any()))
        .thenReturn(new VideoQualityAssurance.QAEvaluation(true, null, null, null, false));

    ProducedArtifactDto produced =
        new ProducedArtifactDto(artifactId, "video", "video/mp4", 1048576L, "sha256:abc");
    ComputeObservationDto observation =
        new ComputeObservationDto(
            "1.0",
            jobId,
            job.getComputeAttemptId(),
            "SUCCEEDED",
            1,
            Instant.now(),
            "ltx:123",
            1.0,
            List.of(produced),
            null,
            null);

    finalizer.finalizeResult(job, observation);

    verify(artifactAccess).verifyOutput(target, produced);
    verify(mediaAssetRepository).createGeneratedAsset(any());

    ArgumentCaptor<TakeRow> takeCaptor = ArgumentCaptor.forClass(TakeRow.class);
    verify(takeMapper).updateValidation(takeCaptor.capture());
    TakeRow updatedTake = takeCaptor.getValue();
    assertEquals("PASSED", updatedTake.getStatus());
    assertEquals("PASSED", updatedTake.getValidationStatus());
    assertEquals(artifactId, updatedTake.getOutputAssetId());

    verify(takeMapper).updateStatus(takeId, "PASSED");
    verify(selectedTakeMapper).insert(any());
    verify(shotMapper).updateStatus(shotId, "SELECTED");
    verify(generationJobRepository).save(any());
  }

  @Test
  void finalizeResultHandlesValidationFailure() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID artifactId = UuidV7.random();
    UUID takeId = UuidV7.random();

    GenerationJob job =
        GenerationJob.rehydrate(
            jobId,
            0L,
            jobId,
            projectId,
            JobType.CHAPTER_GENERATE,
            JobStatus.RUNNING,
            ResourceClass.GPU_HEAVY,
            0,
            null,
            null,
            null,
            UuidV7.random(),
            null,
            1L,
            "hash",
            "Hero runs",
            "vi",
            "idemp:1",
            UuidV7.random(),
            1,
            ProductionMode.VIDEO_FIRST,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            null,
            null,
            null);

    when(generationJobRepository.findByJobId(jobId)).thenReturn(Optional.of(job));

    OutputArtifactTargetDto target =
        new OutputArtifactTargetDto(artifactId, "video", "video/mp4", null);
    when(artifactAccess.getOrCreateTarget(
            any(), any(), eq(artifactId), eq("video"), eq("video/mp4")))
        .thenReturn(target);

    TakeRow takeRow = new TakeRow();
    takeRow.setId(takeId);
    takeRow.setAttemptNumber(1);
    takeRow.setStatus("RUNNING");
    when(takeMapper.findByJobId(jobId.toString())).thenReturn(List.of(takeRow));

    when(videoQualityAssurance.evaluateTake(
            anyInt(), any(), eq(VideoQAFailureCategory.TECHNICAL_OUTPUT), any()))
        .thenReturn(
            new VideoQualityAssurance.QAEvaluation(
                false,
                VideoQAFailureCategory.TECHNICAL_OUTPUT,
                "Generated video output is empty (0 bytes)",
                "RETRY_WITH_HIGHER_STEPS",
                true));

    // Zero bytes to trigger technical validation failure
    ProducedArtifactDto produced =
        new ProducedArtifactDto(artifactId, "video", "video/mp4", 0L, "sha256:empty");
    ComputeObservationDto observation =
        new ComputeObservationDto(
            "1.0",
            jobId,
            job.getComputeAttemptId(),
            "SUCCEEDED",
            1,
            Instant.now(),
            "ltx:123",
            1.0,
            List.of(produced),
            null,
            null);

    finalizer.finalizeResult(job, observation);

    ArgumentCaptor<TakeRow> takeCaptor = ArgumentCaptor.forClass(TakeRow.class);
    verify(takeMapper).updateValidation(takeCaptor.capture());
    TakeRow updatedTake = takeCaptor.getValue();
    assertEquals("FAILED", updatedTake.getStatus());
    assertEquals("FAILED", updatedTake.getValidationStatus());
    assertEquals("TECHNICAL_OUTPUT", updatedTake.getValidationFailureCategory());
    assertEquals("RETRY_WITH_HIGHER_STEPS", updatedTake.getValidationRetryRecommendation());
    verify(takeMapper).updateStatus(takeId, "FAILED");
  }

  @Test
  void throwsWhenObservationMissingRequiredVideo() {
    UUID jobId = UuidV7.random();
    GenerationJob job = mock(GenerationJob.class);
    when(job.getStatus()).thenReturn(JobStatus.RUNNING);
    when(job.getJobId()).thenReturn(jobId);
    when(job.getType()).thenReturn(JobType.CHAPTER_GENERATE);

    ComputeObservationDto observation =
        new ComputeObservationDto(
            "1.0",
            jobId,
            null,
            "SUCCEEDED",
            1,
            Instant.now(),
            "ltx:123",
            1.0,
            List.of(),
            null,
            null);

    assertThrows(IllegalArgumentException.class, () -> finalizer.finalizeResult(job, observation));
  }
}
