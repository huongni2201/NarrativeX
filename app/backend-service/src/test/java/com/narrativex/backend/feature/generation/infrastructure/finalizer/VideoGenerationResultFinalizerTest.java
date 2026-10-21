package com.narrativex.backend.feature.generation.infrastructure.finalizer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

class VideoGenerationResultFinalizerTest {
  private GenerationJobRepository generationJobRepository;
  private MediaAssetRepository mediaAssetRepository;
  private ComputeArtifactAccess artifactAccess;
  private TakeMapper takeMapper;
  private VideoQualityAssurance videoQualityAssurance;
  private com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper
      shotMapper;
  private VideoGenerationResultFinalizer finalizer;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    mediaAssetRepository = mock(MediaAssetRepository.class);
    artifactAccess = mock(ComputeArtifactAccess.class);
    takeMapper = mock(TakeMapper.class);
    videoQualityAssurance = mock(VideoQualityAssurance.class);
    shotMapper =
        mock(
            com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper
                .class);
    finalizer =
        new VideoGenerationResultFinalizer(
            generationJobRepository,
            mediaAssetRepository,
            artifactAccess,
            takeMapper,
            videoQualityAssurance,
            shotMapper);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void finalizeResultRequiresNativeEvidenceDespitePassingContentQa(boolean hasTechnicalEvidence) {
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
        new ProducedArtifactDto(
            artifactId,
            "video",
            "video/mp4",
            1048576L,
            "sha256:abc",
            hasTechnicalEvidence
                ? new ProducedArtifactDto.TechnicalMetadata(5000L, 1280, 720, 24.0, true, true)
                : null);
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
    assertEquals(artifactId, updatedTake.getOutputAssetId());
    if (hasTechnicalEvidence) {
      assertEquals("PASSED", updatedTake.getStatus());
      assertEquals("PASSED", updatedTake.getValidationStatus());
      assertEquals(5000L, updatedTake.getSourceDurationMs());
      verify(takeMapper).updateStatus(takeId, "PASSED");
      verify(shotMapper).updateStatus(shotId, "MANUAL_REVIEW");
    } else {
      assertEquals("FAILED", updatedTake.getStatus());
      assertEquals("TECHNICAL_OUTPUT", updatedTake.getValidationFailureCategory());
      verify(takeMapper).updateStatus(takeId, "FAILED");
      verifyNoInteractions(shotMapper);
    }
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

  private TakeRow finalizeWithQuality(
      com.narrativex.backend.feature.generation.application.model.compute.VideoQualityMetricsDto
          quality) {
    UUID jobId = UuidV7.random();
    UUID artifactId = UuidV7.random();
    GenerationJob job = mock(GenerationJob.class);
    when(job.getStatus()).thenReturn(JobStatus.RUNNING);
    when(job.getJobId()).thenReturn(jobId);
    when(job.getProjectId()).thenReturn(UuidV7.random());
    when(job.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    OutputArtifactTargetDto target =
        new OutputArtifactTargetDto(artifactId, "video", "video/mp4", null);
    when(artifactAccess.getOrCreateTarget(
            any(), any(), eq(artifactId), eq("video"), eq("video/mp4")))
        .thenReturn(target);
    when(artifactAccess.storageKey(target)).thenReturn("projects/p/assets/" + artifactId + ".mp4");
    TakeRow takeRow = new TakeRow();
    takeRow.setId(UuidV7.random());
    takeRow.setAttemptNumber(1);
    takeRow.setGenerationMode("TEXT_TO_VIDEO");
    when(takeMapper.findByJobId(jobId.toString())).thenReturn(List.of(takeRow));
    when(videoQualityAssurance.evaluateTake(anyInt(), any(), any(), any()))
        .thenReturn(new VideoQualityAssurance.QAEvaluation(true, null, null, null, false));
    ProducedArtifactDto produced =
        new ProducedArtifactDto(
            artifactId,
            "video",
            "video/mp4",
            1048576L,
            "sha256:abc",
            new ProducedArtifactDto.TechnicalMetadata(5000L, 1280, 720, 24.0, true, true, quality));

    finalizer.finalizeResult(
        job,
        new ComputeObservationDto(
            "1.0",
            jobId,
            null,
            "SUCCEEDED",
            1,
            Instant.now(),
            "ltx:123",
            1.0,
            List.of(produced),
            null,
            null));
    return takeRow;
  }

  @Test
  void finalizeResultStoresQualityMeasurementsWithoutChangingValidation() throws Exception {
    var quality =
        new com.narrativex.backend.feature.generation.application.model.compute
            .VideoQualityMetricsDto(
            "MEASURED",
            "FFMPEG_TAKE_QC_V1",
            null,
            417L,
            583L,
            2.84,
            0,
            0.62,
            0L,
            1200L,
            -19.4,
            -3.1,
            118.2,
            126.7,
            129.1);

    TakeRow take = finalizeWithQuality(quality);

    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(takeMapper).updateQualityControl(eq(take.getId()), json.capture());
    var stored = new tools.jackson.databind.ObjectMapper().readTree(json.getValue());
    assertEquals("MEASURED", stored.get("status").asText());
    assertEquals("FFMPEG_TAKE_QC_V1", stored.get("scorerVersion").asText());
    assertEquals(417, stored.get("freezeHeadMs").asInt());
    assertEquals(129.1, stored.get("meanV").asDouble());
    assertEquals("PASSED", take.getValidationStatus());
  }

  @Test
  void finalizeResultStoresUnavailableMeasurementWithItsReason() throws Exception {
    var unavailable =
        new com.narrativex.backend.feature.generation.application.model.compute
            .VideoQualityMetricsDto(
            "UNAVAILABLE",
            "FFMPEG_TAKE_QC_V1",
            "timed out",
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
            null);

    TakeRow take = finalizeWithQuality(unavailable);

    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(takeMapper).updateQualityControl(eq(take.getId()), json.capture());
    var stored = new tools.jackson.databind.ObjectMapper().readTree(json.getValue());
    assertEquals("UNAVAILABLE", stored.get("status").asText());
    assertEquals("timed out", stored.get("reason").asText());
    assertEquals(false, stored.has("freezeTotalMs"));
  }

  @Test
  void finalizeResultWithoutMeasurementsLeavesMetricsUntouched() {
    TakeRow take = finalizeWithQuality(null);

    org.mockito.Mockito.verify(takeMapper, org.mockito.Mockito.never())
        .updateQualityControl(any(), any());
    assertEquals("PASSED", take.getValidationStatus());
  }
}
