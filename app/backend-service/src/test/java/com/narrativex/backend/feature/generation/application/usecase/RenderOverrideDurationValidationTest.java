package com.narrativex.backend.feature.generation.application.usecase;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository;
import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository.SelectableMediaAsset;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RenderOverrideDurationValidationTest {
  @Test
  void trimValidationUsesOverriddenBeatDuration() {
    CurrentUserId currentUserId = mock(CurrentUserId.class);
    GetProductionTimelineUseCase timelineUseCase = mock(GetProductionTimelineUseCase.class);
    ProductionBeatMediaSelectionRepository repository = mock(ProductionBeatMediaSelectionRepository.class);
    UpdateProductionBeatMediaUseCase useCase =
        new UpdateProductionBeatMediaUseCase(currentUserId, timelineUseCase, repository);

    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID beatId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    ProductionTimelineView.Beat beat =
        new ProductionTimelineView.Beat(
            chapterId,
            0,
            0,
            0,
            beatId,
            "Beat",
            "Intent",
            "NONE",
            "USER_SELECTED",
            assetId,
            "VIDEO",
            "LOCAL_ONLY",
            8_000L,
            "FREEZE_END",
            0L,
            true,
            null,
            100L,
            "a".repeat(64),
            0L,
            10_000L,
            10_000L,
            true);

    when(currentUserId.get()).thenReturn("owner");
    when(timelineUseCase.executeOwned(projectId, "owner"))
        .thenReturn(
            new ProductionTimelineView(
                projectId,
                UUID.randomUUID(),
                10_000L,
                "16:9",
                true,
                List.of(),
                List.of(beat)));
    when(repository.findSelectableAsset("owner", assetId))
        .thenReturn(
            Optional.of(
                new SelectableMediaAsset(
                    assetId, "VIDEO", "LOCAL_ONLY", 8_000L, 100L, "a".repeat(64))));

    useCase.applyRenderOverrides(
        projectId, List.of(new RenderBeatOverride(beatId, 6_000L, null, "TRIM", 0L)));

    verify(repository).upsert(projectId, beatId, assetId, BeatMediaFitMode.TRIM, 0L);
  }
}
