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

class GetProductionTimelineFallbackTimingTest {
  private final CurrentUserId currentUserId = mock(CurrentUserId.class);
  private final ProjectAccess projectAccess = mock(ProjectAccess.class);
  private final ProductionTimelineSourceRepository sourceRepository =
      mock(ProductionTimelineSourceRepository.class);
  private final GetProductionTimelineUseCase useCase =
      new GetProductionTimelineUseCase(currentUserId, projectAccess, sourceRepository);

  @Test
  void admitsFallbackTimelineWhenNarrationAndVisualAssetsAreReady() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

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
                    10_000L,
                    2,
                    2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                readyBeat(chapterId, 0, "b".repeat(64)),
                readyBeat(chapterId, 1, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.readyForRender()).isTrue();
    assertThat(timeline.chapters().getFirst().readyForRender()).isTrue();
    assertThat(timeline.beats())
        .extracting(beat -> List.of(beat.startMs(), beat.endMs()))
        .containsExactly(List.of(0L, 5_000L), List.of(5_000L, 10_000L));
  }

  private static BeatSource readyBeat(UUID chapterId, int beatIndex, String checksum) {
    return new BeatSource(
        chapterId,
        0,
        null,
        null,
        0,
        beatIndex,
        UUID.randomUUID(),
        "Beat " + beatIndex,
        "Visual intent " + beatIndex,
        "NONE",
        "GENERATE_NEW",
        null,
        null,
        null,
        UUID.randomUUID(),
        "IMAGE",
        null,
        "TRIM",
        0L,
        false,
        null,
        100L,
        checksum);
  }
}
