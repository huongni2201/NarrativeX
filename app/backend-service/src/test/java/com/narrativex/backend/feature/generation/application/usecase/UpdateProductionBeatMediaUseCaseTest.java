package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository;
import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository.SelectableMediaAsset;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class UpdateProductionBeatMediaUseCaseTest {
  private final CurrentUserId currentUserId = mock(CurrentUserId.class);
  private final GetProductionTimelineUseCase getProductionTimelineUseCase =
      mock(GetProductionTimelineUseCase.class);
  private final ProductionBeatMediaSelectionRepository repository =
      mock(ProductionBeatMediaSelectionRepository.class);
  private final UpdateProductionBeatMediaUseCase useCase =
      new UpdateProductionBeatMediaUseCase(currentUserId, getProductionTimelineUseCase, repository);

  @Test
  void updatesVideoSelectionWithFreezeEnd() {
    UUID projectId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID mediaAssetId = UUID.randomUUID();
    when(currentUserId.get()).thenReturn("owner");
    when(getProductionTimelineUseCase.executeOwned(projectId, "owner"))
        .thenReturn(timeline(projectId, visualBeatId, 10_000L));
    when(repository.findSelectableAsset("owner", mediaAssetId))
        .thenReturn(
            java.util.Optional.of(
                new SelectableMediaAsset(
                    mediaAssetId, "VIDEO", "LOCAL_ONLY", 5_000L, 123L, "a".repeat(64))));

    useCase.update(
        projectId, visualBeatId, mediaAssetId, BeatMediaFitMode.FREEZE_END, 0L);

    verify(repository)
        .upsert(projectId, visualBeatId, mediaAssetId, BeatMediaFitMode.FREEZE_END, 0L);
  }

  @Test
  void rejectsTrimWhenVideoIsShorterThanNarration() {
    UUID projectId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID mediaAssetId = UUID.randomUUID();
    when(currentUserId.get()).thenReturn("owner");
    when(getProductionTimelineUseCase.executeOwned(projectId, "owner"))
        .thenReturn(timeline(projectId, visualBeatId, 10_000L));
    when(repository.findSelectableAsset("owner", mediaAssetId))
        .thenReturn(
            java.util.Optional.of(
                new SelectableMediaAsset(
                    mediaAssetId, "VIDEO", "LOCAL_ONLY", 5_000L, 123L, "b".repeat(64))));

    assertThatThrownBy(
            () ->
                useCase.update(
                    projectId, visualBeatId, mediaAssetId, BeatMediaFitMode.TRIM, 0L))
        .isInstanceOfSatisfying(
            GenerationAdmissionDeniedException.class,
            error -> assertThat(error.getCode()).isEqualTo("INVALID_BEAT_MEDIA_SELECTION"))
        .hasMessageContaining("shorter than the narration span");

    verify(repository, never())
        .upsert(projectId, visualBeatId, mediaAssetId, BeatMediaFitMode.TRIM, 0L);
  }

  @Test
  void rejectsVideoFitControlsForImage() {
    UUID projectId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID mediaAssetId = UUID.randomUUID();
    when(currentUserId.get()).thenReturn("owner");
    when(getProductionTimelineUseCase.executeOwned(projectId, "owner"))
        .thenReturn(timeline(projectId, visualBeatId, 10_000L));
    when(repository.findSelectableAsset("owner", mediaAssetId))
        .thenReturn(
            java.util.Optional.of(
                new SelectableMediaAsset(
                    mediaAssetId, "IMAGE", "LOCAL_ONLY", null, 123L, "c".repeat(64))));

    assertThatThrownBy(
            () ->
                useCase.update(
                    projectId, visualBeatId, mediaAssetId, BeatMediaFitMode.LOOP, 0L))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Image beats do not support video trim/loop/speed fit modes");

    verify(repository, never())
        .upsert(projectId, visualBeatId, mediaAssetId, BeatMediaFitMode.LOOP, 0L);
  }

  @Test
  void clearValidatesBeatAndDeletesSelection() {
    UUID projectId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    when(currentUserId.get()).thenReturn("owner");
    when(getProductionTimelineUseCase.executeOwned(projectId, "owner"))
        .thenReturn(timeline(projectId, visualBeatId, 10_000L));

    useCase.clear(projectId, visualBeatId);

    verify(repository).clear(projectId, visualBeatId);
  }

  private static ProductionTimelineView timeline(
      UUID projectId, UUID visualBeatId, long durationMs) {
    UUID chapterId = UUID.randomUUID();
    return new ProductionTimelineView(
        projectId,
        UUID.randomUUID(),
        durationMs,
        "16:9",
        true,
        List.of(),
        List.of(
            new ProductionTimelineView.Beat(
                chapterId,
                0,
                0,
                0,
                visualBeatId,
                "Beat",
                "Intent",
                "NONE",
                "GENERATE_NEW",
                UUID.randomUUID(),
                "IMAGE",
                "REMOTE",
                null,
                "TRIM",
                0L,
                false,
                "images/beat.png",
                100L,
                "d".repeat(64),
                0L,
                durationMs,
                durationMs,
                true)));
  }
}
