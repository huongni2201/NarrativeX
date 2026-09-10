package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository.BeatSource;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository.ChapterSource;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetProductionTimelineUseCaseTest {
  private final CurrentUserId currentUserId = mock(CurrentUserId.class);
  private final ProjectAccess projectAccess = mock(ProjectAccess.class);
  private final ProductionTimelineSourceRepository sourceRepository =
      mock(ProductionTimelineSourceRepository.class);
  private final GetProductionTimelineUseCase useCase =
      new GetProductionTimelineUseCase(currentUserId, projectAccess, sourceRepository);

  @Test
  void returnsEmptyTimelineForProjectWithoutChapters() {
    UUID projectId = UUID.randomUUID();
    when(sourceRepository.findChapters(projectId, "owner")).thenReturn(List.of());

    var timeline = useCase.executeOwned(projectId, "owner");

    verify(projectAccess).findOwnedProject(projectId, "owner");
    assertThat(timeline.projectId()).isEqualTo(projectId);
    assertThat(timeline.storyVersionId()).isNull();
    assertThat(timeline.totalDurationMs()).isZero();
    assertThat(timeline.aspectRatio()).isEqualTo("16:9");
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters()).isEmpty();
    assertThat(timeline.beats()).isEmpty();
  }

  @Test
  void keepsFallbackTimelineInspectableButLocksRenderWithoutAlignment() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(List.of(chapter(storyVersionId, chapterId, 10_000L, 2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beatWithText(chapterId, 0, 0, 0, 40, "b".repeat(64)),
                beatWithText(chapterId, 0, 1, 40, 100, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.beats())
        .extracting(beat -> List.of(beat.startMs(), beat.endMs(), beat.durationMs()))
        .containsExactly(List.of(0L, 4_000L, 4_000L), List.of(4_000L, 10_000L, 6_000L));
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  @Test
  void derivesVisualClockFromSourceRangesAndNarrationAlignment() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    String spans =
        """
        [
          {"index":0,"textStart":0,"textEnd":50,"audioStartMs":0,"audioEndMs":5000},
          {"index":1,"textStart":50,"textEnd":100,"audioStartMs":5000,"audioEndMs":10000}
        ]
        """;

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(List.of(chapterWithAlignment(storyVersionId, chapterId, 10_000L, spans, 3)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beatWithText(chapterId, 0, 0, 0, 40, "b".repeat(64)),
                beatWithText(chapterId, 0, 1, 40, 70, "c".repeat(64)),
                beatWithText(chapterId, 0, 2, 70, 100, "d".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.readyForRender()).isTrue();
    assertThat(timeline.beats())
        .extracting(beat -> List.of(beat.startMs(), beat.endMs(), beat.durationMs()))
        .containsExactly(
            List.of(0L, 4_000L, 4_000L),
            List.of(4_000L, 7_000L, 3_000L),
            List.of(7_000L, 10_000L, 3_000L));
  }

  @Test
  void locksRenderWhenNarrationAlignmentCannotMapEveryBeat() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    String incompleteSpans =
        """
        [{"index":0,"textStart":0,"textEnd":50,"audioStartMs":0,"audioEndMs":10000}]
        """;

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                chapterWithAlignment(
                    storyVersionId, chapterId, 10_000L, incompleteSpans, 2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beatWithText(chapterId, 0, 0, 0, 40, "b".repeat(64)),
                beatWithText(chapterId, 0, 1, 60, 100, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.beats()).hasSize(2);
    assertThat(timeline.beats().getFirst().startMs()).isZero();
    assertThat(timeline.beats().getLast().endMs()).isEqualTo(10_000L);
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  @Test
  void keepsExactTimelineInspectableButLocksFinalRenderWhenAnAssetIsMissing() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    String spans =
        """
        [{"index":0,"textStart":0,"textEnd":100,"audioStartMs":0,"audioEndMs":10000}]
        """;
    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(List.of(chapterWithAlignment(storyVersionId, chapterId, 10_000L, spans, 2)));
    BeatSource ready = beatWithText(chapterId, 0, 0, 0, 40, "b".repeat(64));
    BeatSource missing = beatWithText(chapterId, 0, 1, 40, 100, null, false);
    when(sourceRepository.findBeats(projectId, "owner")).thenReturn(List.of(ready, missing));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.totalDurationMs()).isEqualTo(10_000L);
    assertThat(timeline.beats()).hasSize(2);
    assertThat(timeline.beats().getFirst().endMs()).isEqualTo(4_000L);
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  private static ChapterSource chapter(
      UUID storyVersionId, UUID chapterId, long audioDurationMs, int beatCount) {
    return new ChapterSource(
        storyVersionId,
        chapterId,
        0,
        "Chapter 1",
        3L,
        "0".repeat(64),
        null,
        null,
        "16:9",
        audioDurationMs,
        "audio/chapter.mp3",
        100L,
        "a".repeat(64),
        UUID.randomUUID(),
        UUID.randomUUID(),
        null,
        audioDurationMs,
        beatCount,
        beatCount);
  }

  private static ChapterSource chapterWithAlignment(
      UUID storyVersionId, UUID chapterId, long durationMs, String spansJson, int beatCount) {
    return new ChapterSource(
        storyVersionId,
        chapterId,
        0,
        "Chapter 1",
        3L,
        "0".repeat(64),
        null,
        null,
        "16:9",
        durationMs,
        "audio/chapter.mp3",
        100L,
        "a".repeat(64),
        UUID.randomUUID(),
        UUID.randomUUID(),
        UUID.randomUUID(),
        "x".repeat(100),
        spansJson,
        durationMs,
        beatCount,
        beatCount);
  }

  private static BeatSource beatWithText(
      UUID chapterId,
      int chapterOrderIndex,
      int beatIndex,
      int textStart,
      int textEnd,
      String checksum) {
    return beatWithText(chapterId, chapterOrderIndex, beatIndex, textStart, textEnd, checksum, true);
  }

  private static BeatSource beatWithText(
      UUID chapterId,
      int chapterOrderIndex,
      int beatIndex,
      int textStart,
      int textEnd,
      String checksum,
      boolean hasAsset) {
    return new BeatSource(
        chapterId,
        chapterOrderIndex,
        null,
        null,
        0,
        beatIndex,
        UUID.randomUUID(),
        "Beat " + beatIndex,
        "Visual intent " + beatIndex,
        "NONE",
        "GENERATE_NEW",
        textStart,
        textEnd,
        hasAsset ? UUID.randomUUID() : null,
        hasAsset ? "IMAGE" : null,
        null,
        "TRIM",
        0L,
        false,
        null,
        hasAsset ? 100L : null,
        checksum);
  }
}
