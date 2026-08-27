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
  void buildsOneContiguousGlobalClockFromChapterAudioDurations() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID firstChapter = UUID.randomUUID();
    UUID secondChapter = UUID.randomUUID();
    UUID firstPlan = UUID.randomUUID();
    UUID secondPlan = UUID.randomUUID();

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                chapter(
                    storyVersionId,
                    firstChapter,
                    0,
                    firstPlan,
                    120_000L,
                    "audio/chapter-1.mp3",
                    "a".repeat(64),
                    2),
                chapter(
                    storyVersionId,
                    secondChapter,
                    1,
                    secondPlan,
                    60_000L,
                    "audio/chapter-2.mp3",
                    "b".repeat(64),
                    2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beat(firstChapter, 0, firstPlan, 0, 30_000L, "c".repeat(64)),
                beat(firstChapter, 0, firstPlan, 1, 90_000L, "d".repeat(64)),
                beat(secondChapter, 1, secondPlan, 0, null, "e".repeat(64)),
                beat(secondChapter, 1, secondPlan, 1, null, "f".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    verify(projectAccess).findOwnedProject(projectId, "owner");
    assertThat(timeline.readyForRender()).isTrue();
    assertThat(timeline.totalDurationMs()).isEqualTo(180_000L);
    assertThat(timeline.chapters())
        .extracting(chapter -> List.of(chapter.startMs(), chapter.endMs()))
        .containsExactly(List.of(0L, 120_000L), List.of(120_000L, 180_000L));
    assertThat(timeline.beats())
        .extracting(beat -> List.of(beat.startMs(), beat.endMs()))
        .containsExactly(
            List.of(0L, 30_000L),
            List.of(30_000L, 120_000L),
            List.of(120_000L, 150_000L),
            List.of(150_000L, 180_000L));
  }

  @Test
  void keepsTimelineInspectableButLocksFinalRenderWhenAnAssetIsMissing() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID planId = UUID.randomUUID();

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                chapter(
                    storyVersionId,
                    chapterId,
                    0,
                    planId,
                    60_000L,
                    "audio/chapter.mp3",
                    "a".repeat(64),
                    2)));
    BeatSource ready = beat(chapterId, 0, planId, 0, 30_000L, "b".repeat(64));
    BeatSource missing =
        new BeatSource(
            chapterId,
            0,
            planId,
            1,
            0,
            1,
            UUID.randomUUID(),
            "Missing image",
            "Missing image",
            "NONE",
            "GENERATE_NEW",
            null,
            null,
            30_000L,
            null,
            null,
            null,
            null,
            "TRIM",
            0L,
            false,
            null,
            null,
            null);
    when(sourceRepository.findBeats(projectId, "owner")).thenReturn(List.of(ready, missing));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.totalDurationMs()).isEqualTo(60_000L);
    assertThat(timeline.beats()).hasSize(2);
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  @Test
  void locksFinalRenderWhenBeatRowsComeFromAnotherMediaPlanRevision() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID chapterPlanId = UUID.randomUUID();
    UUID differentPlanId = UUID.randomUUID();

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                chapter(
                    storyVersionId,
                    chapterId,
                    0,
                    chapterPlanId,
                    60_000L,
                    "audio/chapter.mp3",
                    "a".repeat(64),
                    1)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(List.of(beat(chapterId, 0, differentPlanId, 0, 60_000L, "b".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.totalDurationMs()).isEqualTo(60_000L);
    assertThat(timeline.beats()).hasSize(1);
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  @Test
  void locksFinalRenderWhenAudioCannotRepresentOnePositiveIntervalPerBeat() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID planId = UUID.randomUUID();

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                chapter(
                    storyVersionId,
                    chapterId,
                    0,
                    planId,
                    1L,
                    "audio/chapter.mp3",
                    "a".repeat(64),
                    2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beat(chapterId, 0, planId, 0, null, "b".repeat(64)),
                beat(chapterId, 0, planId, 1, null, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.totalDurationMs()).isEqualTo(1L);
    assertThat(timeline.beats()).isEmpty();
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  private static ChapterSource chapter(
      UUID storyVersionId,
      UUID chapterId,
      int orderIndex,
      UUID mediaPlanId,
      long audioDurationMs,
      String audioStorageKey,
      String audioChecksum,
      int beatCount) {
    return new ChapterSource(
        storyVersionId,
        chapterId,
        orderIndex,
        "Chapter " + (orderIndex + 1),
        3L,
        "0".repeat(64),
        mediaPlanId,
        1,
        "16:9",
        audioDurationMs,
        audioStorageKey,
        100L,
        audioChecksum,
        UUID.randomUUID(),
        UUID.randomUUID(),
        UUID.randomUUID(),
        audioDurationMs,
        beatCount,
        beatCount);
  }

  private static BeatSource beat(
      UUID chapterId,
      int chapterOrderIndex,
      UUID mediaPlanId,
      int beatIndex,
      Long audioDurationMs,
      String checksum) {
    UUID visualBeatId = UUID.randomUUID();
    return new BeatSource(
        chapterId,
        chapterOrderIndex,
        mediaPlanId,
        1,
        0,
        beatIndex,
        visualBeatId,
        "Beat " + beatIndex,
        "Visual intent " + beatIndex,
        "NONE",
        "GENERATE_NEW",
        null,
        null,
        audioDurationMs,
        UUID.randomUUID(),
        "IMAGE",
        "REMOTE",
        null,
        "TRIM",
        0L,
        false,
        "images/" + visualBeatId + ".png",
        100L,
        checksum);
  }
}
