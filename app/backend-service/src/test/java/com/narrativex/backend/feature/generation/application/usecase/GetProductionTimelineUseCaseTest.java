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
  void rendersExactProjectLocalTimelineWithoutMediaPlan() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                chapter(
                    storyVersionId,
                    chapterId,
                    0,
                    10_000L,
                    "audio/chapter.mp3",
                    "a".repeat(64),
                    2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beat(chapterId, 0, 0, 0L, 4_000L, "b".repeat(64)),
                beat(chapterId, 0, 1, 4_000L, 10_000L, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    verify(projectAccess).findOwnedProject(projectId, "owner");
    assertThat(timeline.readyForRender()).isTrue();
    assertThat(timeline.totalDurationMs()).isEqualTo(10_000L);
    assertThat(timeline.chapters().getFirst().mediaPlanId()).isNull();
    assertThat(timeline.chapters().getFirst().mediaPlanRevision()).isNull();
    assertThat(timeline.beats())
        .extracting(beat -> List.of(beat.startMs(), beat.endMs(), beat.durationMs()))
        .containsExactly(List.of(0L, 4_000L, 4_000L), List.of(4_000L, 10_000L, 6_000L));
  }

  @Test
  void normalizesBoundedVisualTailDriftToNarrationDuration() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(
            List.of(
                chapter(
                    storyVersionId,
                    chapterId,
                    0,
                    10_000L,
                    "audio/chapter.mp3",
                    "a".repeat(64),
                    2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(
            List.of(
                beat(chapterId, 0, 0, 0L, 4_000L, "b".repeat(64)),
                beat(chapterId, 0, 1, 4_000L, 10_024L, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.readyForRender()).isTrue();
    assertThat(timeline.beats().getLast().startMs()).isEqualTo(4_000L);
    assertThat(timeline.beats().getLast().endMs()).isEqualTo(10_000L);
    assertThat(timeline.beats().getLast().durationMs()).isEqualTo(6_000L);
  }

  @Test
  void keepsTimelineInspectableButLocksRenderWhenExactTimingIsMissing() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(List.of(chapter(storyVersionId, chapterId, 0, 10_000L, "audio/chapter.mp3", "a".repeat(64), 2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(List.of(beat(chapterId, 0, 0, null, null, "b".repeat(64)), beat(chapterId, 0, 1, null, null, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.beats()).hasSize(2);
    assertThat(timeline.beats().getFirst().startMs()).isZero();
    assertThat(timeline.beats().getLast().endMs()).isEqualTo(10_000L);
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  @Test
  void keepsTimelineInspectableButLocksRenderWhenTimingHasGap() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(List.of(chapter(storyVersionId, chapterId, 0, 10_000L, "audio/chapter.mp3", "a".repeat(64), 2)));
    when(sourceRepository.findBeats(projectId, "owner"))
        .thenReturn(List.of(beat(chapterId, 0, 0, 0L, 4_000L, "b".repeat(64)), beat(chapterId, 0, 1, 5_000L, 10_000L, "c".repeat(64))));

    var timeline = useCase.executeOwned(projectId, "owner");

    assertThat(timeline.beats()).hasSize(2);
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  @Test
  void keepsTimelineInspectableButLocksFinalRenderWhenAnAssetIsMissing() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    when(sourceRepository.findChapters(projectId, "owner"))
        .thenReturn(List.of(chapter(storyVersionId, chapterId, 0, 10_000L, "audio/chapter.mp3", "a".repeat(64), 2)));
    BeatSource ready = beat(chapterId, 0, 0, 0L, 4_000L, "b".repeat(64));
    BeatSource missing =
        new BeatSource(
            chapterId,
            0,
            null,
            null,
            0,
            1,
            UUID.randomUUID(),
            "Missing image",
            "Missing image",
            "NONE",
            "GENERATE_NEW",
            4_000L,
            10_000L,
            6_000L,
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

    assertThat(timeline.totalDurationMs()).isEqualTo(10_000L);
    assertThat(timeline.beats()).hasSize(2);
    assertThat(timeline.readyForRender()).isFalse();
    assertThat(timeline.chapters().getFirst().readyForRender()).isFalse();
  }

  private static ChapterSource chapter(
      UUID storyVersionId,
      UUID chapterId,
      int orderIndex,
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
        null,
        null,
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
      int beatIndex,
      Long audioStartMs,
      Long audioEndMs,
      String checksum) {
    UUID visualBeatId = UUID.randomUUID();
    Long durationMs = audioStartMs != null && audioEndMs != null && audioEndMs > audioStartMs
        ? audioEndMs - audioStartMs
        : null;
    return new BeatSource(
        chapterId,
        chapterOrderIndex,
        null,
        null,
        0,
        beatIndex,
        visualBeatId,
        "Beat " + beatIndex,
        "Visual intent " + beatIndex,
        "NONE",
        "GENERATE_NEW",
        audioStartMs,
        audioEndMs,
        durationMs,
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
