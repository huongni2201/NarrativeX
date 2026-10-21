package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository.TakeRecord;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.generation.domain.value.TakeContentReviewChecklist;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SelectTakeUseCaseTest {
  private static final TakeContentReviewChecklist COMPLETE_REVIEW =
      new TakeContentReviewChecklist(true, true, true, true, true);
  private final StoryboardProductionAccess storyboardAccess =
      mock(StoryboardProductionAccess.class);
  private final TakeRepository takeRepository = mock(TakeRepository.class);
  private final SelectedTakeRepository selectedTakeRepository = mock(SelectedTakeRepository.class);
  private final MediaAssetAccess mediaAssetAccess = mock(MediaAssetAccess.class);

  private final SelectTakeUseCase useCase =
      new SelectTakeUseCase(
          storyboardAccess, takeRepository, selectedTakeRepository, mediaAssetAccess);

  @Test
  void selectsValidTakeAndUpdatesShotStatus() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            5000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "comfyui",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            assetId,
            5000L,
            "{}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now(),
            null,
            null,
            null,
            null,
            "{}",
            "a".repeat(64));
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    MediaAssetAccess.MediaAssetSummary asset =
        new MediaAssetAccess.MediaAssetSummary(assetId, "VIDEO", "READY", "video/mp4", "video/mp4");
    when(mediaAssetAccess.findSummary(assetId)).thenReturn(Optional.of(asset));

    when(selectedTakeRepository.saveSelection(
            eq(shotId),
            eq(takeId),
            eq(500L),
            eq(4500L),
            eq(0L),
            anyString(),
            eq(COMPLETE_REVIEW.toJson())))
        .thenReturn(
            new SelectedTake(
                shotId,
                takeId,
                500L,
                4500L,
                1L,
                "b".repeat(64),
                COMPLETE_REVIEW.toJson(),
                Instant.now()));

    SelectedTake result =
        useCase.execute(projectId, shotId, takeId, 500L, 4500L, 0L, COMPLETE_REVIEW);

    assertThat(result.shotId()).isEqualTo(shotId);
    assertThat(result.takeId()).isEqualTo(takeId);
    assertThat(result.sourceInMs()).isEqualTo(500L);
    assertThat(result.sourceOutMs()).isEqualTo(4500L);

    verify(selectedTakeRepository)
        .saveSelection(
            eq(shotId),
            eq(takeId),
            eq(500L),
            eq(4500L),
            eq(0L),
            anyString(),
            eq(COMPLETE_REVIEW.toJson()));
    verify(storyboardAccess).updateShotStatus(shotId, "SELECTED");
  }

  @Test
  void rejectsWhenShotNotFoundInProject() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();

    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> select(projectId, shotId, takeId, 0L, 1000L))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void rejectsWhenTakeDoesNotBelongToShot() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            5000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            UUID.randomUUID(), // Different shot
            1,
            "comfyui",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            UUID.randomUUID(),
            5000L,
            "{}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    assertThatThrownBy(() -> select(projectId, shotId, takeId, 0L, 1000L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("does not belong to Shot");
  }

  @Test
  void rejectsWhenTakeHasNoOutputAsset() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            5000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "comfyui",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            null,
            5000L,
            "{}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    assertThatThrownBy(() -> select(projectId, shotId, takeId, 0L, 1000L))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("no output asset");
  }

  @Test
  void rejectsWhenTrimOutOfBounds() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "comfyui",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            assetId,
            4000L,
            "{}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    MediaAssetAccess.MediaAssetSummary asset =
        new MediaAssetAccess.MediaAssetSummary(assetId, "VIDEO", "READY", "video/mp4", "video/mp4");
    when(mediaAssetAccess.findSummary(assetId)).thenReturn(Optional.of(asset));

    // sourceInMs >= sourceOutMs
    assertThatThrownBy(() -> select(projectId, shotId, takeId, 2000L, 2000L))
        .isInstanceOf(IllegalArgumentException.class);

    // sourceOutMs > take source duration
    assertThatThrownBy(() -> select(projectId, shotId, takeId, 0L, 5000L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("exceeds take source duration");
  }

  @Test
  void rejectsWhenTakeInProgress() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "ltx",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            assetId,
            4000L,
            "{}",
            "PENDING",
            null,
            null,
            null,
            "RUNNING",
            Instant.now());
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    assertThatThrownBy(() -> select(projectId, shotId, takeId, 0L, 4000L))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Cannot select take currently in progress");
  }

  @Test
  void rejectsWhenTakeValidationFailed() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "ltx",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            assetId,
            4000L,
            "{}",
            "FAILED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    assertThatThrownBy(() -> select(projectId, shotId, takeId, 0L, 4000L))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("failed QA validation");
  }

  @Test
  void rejectsWhenTakeDurationInvalid() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();

    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));

    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "ltx",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            assetId,
            null,
            "{}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now());
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    MediaAssetAccess.MediaAssetSummary asset =
        new MediaAssetAccess.MediaAssetSummary(assetId, "VIDEO", "READY", "video/mp4", "video/mp4");
    when(mediaAssetAccess.findSummary(assetId)).thenReturn(Optional.of(asset));

    assertThatThrownBy(() -> select(projectId, shotId, takeId, 0L, 1000L))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("invalid or missing source duration");
  }

  @Test
  void rejectsIncompleteHumanReviewBeforeSelectionWrite() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    ShotInfo shot =
        new ShotInfo(
            shotId,
            UUID.randomUUID(),
            1,
            "purpose",
            "HOOK",
            List.of(),
            null,
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            "{}",
            4000L,
            GenerationStrategy.TEXT_TO_VIDEO,
            "STANDARD",
            "READY");
    TakeRecord take =
        new TakeRecord(
            takeId,
            shotId,
            1,
            "comfyui",
            "ltx",
            GenerationStrategy.TEXT_TO_VIDEO,
            assetId,
            4000L,
            "{}",
            "PASSED",
            null,
            null,
            null,
            "COMPLETED",
            Instant.now(),
            null,
            null,
            null,
            null,
            "{}",
            "c".repeat(64));
    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.of(shot));
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));
    when(mediaAssetAccess.findSummary(assetId))
        .thenReturn(
            Optional.of(
                new MediaAssetAccess.MediaAssetSummary(
                    assetId, "VIDEO", "READY", "video/mp4", "video/mp4")));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    projectId,
                    shotId,
                    takeId,
                    0L,
                    4000L,
                    0L,
                    new TakeContentReviewChecklist(true, true, true, true, false)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Complete the content review checklist");
    verify(selectedTakeRepository, org.mockito.Mockito.never())
        .saveSelection(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyLong(),
            anyString(),
            anyString());
  }

  private SelectedTake select(
      UUID projectId, UUID shotId, UUID takeId, long sourceInMs, long sourceOutMs) {
    return useCase.execute(projectId, shotId, takeId, sourceInMs, sourceOutMs, 0L, COMPLETE_REVIEW);
  }
}
