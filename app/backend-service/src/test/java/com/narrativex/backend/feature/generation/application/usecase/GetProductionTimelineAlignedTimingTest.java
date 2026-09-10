package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository.BeatSource;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository.ChapterSource;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetProductionTimelineAlignedTimingTest {
  @Test
  void usesNarrationAlignmentInsteadOfTextWeightFallback() {
    CurrentUserId currentUserId = mock(CurrentUserId.class);
    ProjectAccess projectAccess = mock(ProjectAccess.class);
    ProductionTimelineSourceRepository sourceRepository =
        mock(ProductionTimelineSourceRepository.class);
    GetProductionTimelineUseCase useCase =
        new GetProductionTimelineUseCase(currentUserId, projectAccess, sourceRepository);

    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    String spans =
        """
        [
          {"index":0,"textStart":0,"textEnd":50,"audioStartMs":0,"audioEndMs":2000},
          {"index":1,"textStart":50,"textEnd":100,"audioStartMs":2000,"audioEndMs":10000}
        ]
        """;

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                new ChapterSource(
                    storyVersionId,
                    chapterId,
                    0,
                    "Chapter 1",
                    3L,
                    "0".repeat(64),
                    null,
                    null,
                    "16:9",
                    10_000L,
                    "audio/chapter.mp3",
                    100L,
                    "a".repeat(64),
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    "x".repeat(100),
                    spans,
                    10_000L,
                    2,
                    2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beat(chapterId, 0, 0, 50),
                beat(chapterId, 1, 50, 100)));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.readyForRender()).isTrue();
    assertThat(timeline.beats())
        .extracting(beat -> List.of(beat.startMs(), beat.endMs(), beat.durationMs()))
        .containsExactly(List.of(0L, 2_000L, 2_000L), List.of(2_000L, 10_000L, 8_000L));
  }

  private static BeatSource beat(UUID chapterId, int beatIndex, int textStart, int textEnd) {
    UUID visualBeatId = UUID.randomUUID();
    return new BeatSource(
        chapterId,
        0,
        null,
        null,
        0,
        beatIndex,
        visualBeatId,
        "Beat " + beatIndex,
        "Intent",
        "NONE",
        "GENERATE_NEW",
        textStart,
        textEnd,
        UUID.randomUUID(),
        "IMAGE",
        null,
        "TRIM",
        0L,
        false,
        "images/" + visualBeatId + ".png",
        100L,
        "b".repeat(64));
  }
}
