package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SelectTakeUseCaseTest {
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
            Instant.now());
    when(takeRepository.findById(takeId)).thenReturn(Optional.of(take));

    MediaAssetAccess.MediaAssetSummary asset =
        new MediaAssetAccess.MediaAssetSummary(assetId, "VIDEO", "READY", "video/mp4", "video/mp4");
    when(mediaAssetAccess.findSummary(assetId)).thenReturn(Optional.of(asset));

    SelectedTake result = useCase.execute(projectId, shotId, takeId, 500L, 4500L);

    assertThat(result.shotId()).isEqualTo(shotId);
    assertThat(result.takeId()).isEqualTo(takeId);
    assertThat(result.sourceInMs()).isEqualTo(500L);
    assertThat(result.sourceOutMs()).isEqualTo(4500L);

    verify(selectedTakeRepository).saveSelection(shotId, takeId, 500L, 4500L);
    verify(storyboardAccess).updateShotStatus(shotId, "SELECTED");
  }

  @Test
  void rejectsWhenShotNotFoundInProject() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();

    when(storyboardAccess.findShot(projectId, shotId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.execute(projectId, shotId, takeId, 0L, 1000L))
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

    assertThatThrownBy(() -> useCase.execute(projectId, shotId, takeId, 0L, 1000L))
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

    assertThatThrownBy(() -> useCase.execute(projectId, shotId, takeId, 0L, 1000L))
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
    assertThatThrownBy(() -> useCase.execute(projectId, shotId, takeId, 2000L, 2000L))
        .isInstanceOf(IllegalArgumentException.class);

    // sourceOutMs > take source duration
    assertThatThrownBy(() -> useCase.execute(projectId, shotId, takeId, 0L, 5000L))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("exceeds take source duration");
  }
}
