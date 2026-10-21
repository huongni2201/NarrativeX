package com.narrativex.backend.feature.generation.infrastructure.finalizer;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ImageGenerationResultFinalizerTest {
  private static final String FINGERPRINT = "a".repeat(64);

  private final UUID jobId = UUID.randomUUID();
  private final UUID jobRowId = UUID.randomUUID();
  private final UUID projectId = UUID.randomUUID();
  private final UUID planId = UUID.randomUUID();
  private final UUID visualBeatId = UUID.randomUUID();
  private final UUID artifactId = UUID.randomUUID();

  private GenerationJobRepository generationJobRepository;
  private MediaGenerationItemRepository itemRepository;
  private ImageGenerationResultFinalizer finalizer;
  private GenerationJob job;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    MediaAssetRepository mediaAssetRepository = mock(MediaAssetRepository.class);
    ComputeArtifactAccess artifactAccess = mock(ComputeArtifactAccess.class);
    itemRepository = mock(MediaGenerationItemRepository.class);
    finalizer =
        new ImageGenerationResultFinalizer(
            generationJobRepository, mediaAssetRepository, artifactAccess, itemRepository);

    job = mock(GenerationJob.class);
    when(job.getJobId()).thenReturn(jobId);
    when(job.getId()).thenReturn(jobRowId);
    when(job.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(job.getProjectId()).thenReturn(projectId);
    when(job.getStatus()).thenReturn(JobStatus.RUNNING);
    OutputArtifactTargetDto target =
        new OutputArtifactTargetDto(artifactId, "image", "image/png", null);
    when(artifactAccess.getOrCreateTarget(eq(jobId), any(), eq(artifactId), any(), any()))
        .thenReturn(target);
    when(artifactAccess.storageKey(target)).thenReturn("images/" + artifactId + ".png");
  }

  @Test
  void supportsImageJobsInTheLegacyAndImageMotionModes() {
    assertTrue(finalizer.supports(JobType.CHAPTER_GENERATE, ProductionMode.LEGACY_IMAGE));
    assertTrue(finalizer.supports(JobType.CHAPTER_GENERATE, ProductionMode.IMAGE_MOTION));
    assertTrue(finalizer.supports(JobType.CHAPTER_GENERATE, null));
    assertFalse(finalizer.supports(JobType.CHAPTER_GENERATE, ProductionMode.VIDEO_FIRST));
  }

  @Test
  void attachesTheImageToItsVisualBeatAttemptAndCompletesTheJob() {
    MediaGenerationItem attempt = attemptFor(visualBeatId);
    when(itemRepository.findByJobId(jobRowId)).thenReturn(List.of(attempt));
    GenerationJob completed = mock(GenerationJob.class);
    GenerationJob fresh = mock(GenerationJob.class);
    when(fresh.getStatus()).thenReturn(JobStatus.RUNNING);
    when(fresh.markCompleted("MEDIA_READY")).thenReturn(completed);
    when(generationJobRepository.findByJobId(jobId)).thenReturn(Optional.of(fresh));

    finalizer.finalizeResult(job, observationWithImage());

    verify(itemRepository).completeImageAttempt(attempt.getId(), artifactId);
    verify(generationJobRepository).save(completed);
  }

  @Test
  void refusesToFinalizeWhenTheJobHasNoSingleVisualBeatAttempt() {
    when(itemRepository.findByJobId(jobRowId)).thenReturn(List.of());

    assertThrows(
        IllegalStateException.class, () -> finalizer.finalizeResult(job, observationWithImage()));
  }

  private ComputeObservationDto observationWithImage() {
    ProducedArtifactDto produced =
        new ProducedArtifactDto(artifactId, "image", "image/png", 2048L, "b".repeat(64));
    return new ComputeObservationDto(
        "1.0",
        jobId,
        UUID.randomUUID(),
        "SUCCEEDED",
        2,
        Instant.now(),
        "handle",
        1.0,
        List.of(produced),
        null,
        null);
  }

  private MediaGenerationItem attemptFor(UUID beatId) {
    return MediaGenerationItem.create(jobRowId, planId, beatId, "beat-" + beatId, 1, FINGERPRINT);
  }
}
