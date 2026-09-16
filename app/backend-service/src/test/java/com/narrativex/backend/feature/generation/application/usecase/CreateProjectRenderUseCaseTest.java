package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CreateProjectRenderUseCaseTest {

  @Test
  void rejectsDurationOverrideBecauseNarrationOwnsBeatClock() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID firstBeatId = UUID.randomUUID();
    UUID secondBeatId = UUID.randomUUID();
    ProductionTimelineView timeline =
        timeline(projectId, storyVersionId, chapterId, firstBeatId, secondBeatId);

    assertThatThrownBy(
            () ->
                CreateProjectRenderUseCase.applyBeatOverrides(
                    timeline,
                    List.of(new RenderBeatOverride(firstBeatId, 10_000L, null))))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .satisfies(
            error ->
                assertThat(((GenerationAdmissionDeniedException) error).getCode())
                    .isEqualTo("INVALID_RENDER_OVERRIDE"));

    assertThat(timeline.beats())
        .extracting(beat -> List.of(beat.startMs(), beat.endMs(), beat.durationMs()))
        .containsExactly(List.of(0L, 30_000L, 30_000L), List.of(30_000L, 60_000L, 30_000L));
  }

  @Test
  void localFirstTimelineFingerprintDoesNotRequireMediaPlan() {
    ProductionTimelineView timeline =
        timeline(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID());

    assertThat(timeline.chapters().getFirst().mediaPlanId()).isNull();
    assertThat(timeline.chapters().getFirst().mediaPlanRevision()).isNull();
    assertThat(CreateProjectRenderUseCase.timelineFingerprint(timeline)).hasSize(64);
  }

  @Test
  void projectRenderRequestFingerprintChangesWithResolutionOverridesAssignedDeviceAndSubtitles() {
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID firstBeatId = UUID.randomUUID();
    UUID secondBeatId = UUID.randomUUID();
    UUID localDeviceId = UUID.randomUUID();
    UUID otherDeviceId = UUID.randomUUID();
    ProductionTimelineView timeline =
        timeline(projectId, storyVersionId, chapterId, firstBeatId, secondBeatId);
    String render720 =
        CreateProjectRenderUseCase.requestFingerprint(
            new CreateProjectRenderCommand(
                projectId, "720p", "mp4", null, localDeviceId, true, List.of()));
    String render1080 =
        CreateProjectRenderUseCase.requestFingerprint(
            new CreateProjectRenderCommand(
                projectId, "1080p", "mp4", null, localDeviceId, true, List.of()));
    String renderOtherDevice =
        CreateProjectRenderUseCase.requestFingerprint(
            new CreateProjectRenderCommand(
                projectId, "720p", "mp4", null, otherDeviceId, true, List.of()));
    String renderWithoutSubtitles =
        CreateProjectRenderUseCase.requestFingerprint(
            new CreateProjectRenderCommand(
                projectId, "720p", "mp4", null, localDeviceId, false, List.of()));

    String editedRender720 =
        CreateProjectRenderUseCase.requestFingerprint(
            new CreateProjectRenderCommand(
                projectId,
                "720p",
                "mp4",
                null,
                localDeviceId,
                true,
                List.of(new RenderBeatOverride(firstBeatId, null, "PAN"))));

    assertThat(render720)
        .hasSize(64)
        .isNotEqualTo(render1080)
        .isNotEqualTo(editedRender720)
        .isNotEqualTo(renderOtherDevice)
        .isNotEqualTo(renderWithoutSubtitles);
  }

  @Test
  void projectRenderUsesOnlyLocalStageAndOperationIdentity() {
    assertThat(CreateProjectRenderUseCase.operationType("1080p", "mp4"))
        .isEqualTo("RENDER_PROJECT_LOCAL_1080P_MP4");
  }

  @Test
  void rejectsOverrideForBeatOutsideCurrentProductionTimeline() {
    ProductionTimelineView timeline =
        timeline(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID());

    assertThatThrownBy(
            () ->
                CreateProjectRenderUseCase.applyBeatOverrides(
                    timeline, List.of(new RenderBeatOverride(UUID.randomUUID(), null, "PAN"))))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .satisfies(
            error ->
                assertThat(((GenerationAdmissionDeniedException) error).getCode())
                    .isEqualTo("INVALID_RENDER_OVERRIDE"));
  }

  @Test
  void rejectsDuplicateOverridesForSameBeat() {
    UUID firstBeatId = UUID.randomUUID();
    ProductionTimelineView timeline =
        timeline(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            firstBeatId,
            UUID.randomUUID());

    assertThatThrownBy(
            () ->
                CreateProjectRenderUseCase.applyBeatOverrides(
                    timeline,
                    List.of(
                        new RenderBeatOverride(firstBeatId, null, "PAN"),
                        new RenderBeatOverride(firstBeatId, null, "TILT"))))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .satisfies(
            error ->
                assertThat(((GenerationAdmissionDeniedException) error).getCode())
                    .isEqualTo("INVALID_RENDER_OVERRIDE"));
  }

  private static ProductionTimelineView timeline(
      UUID projectId, UUID storyVersionId, UUID chapterId, UUID firstBeatId, UUID secondBeatId) {
    ProductionTimelineView.Chapter chapter =
        new ProductionTimelineView.Chapter(
            chapterId,
            0,
            "Chapter 1",
            1L,
            "a".repeat(64),
            null,
            null,
            0L,
            60_000L,
            60_000L,
            "audio/chapter-1.mp3",
            100L,
            "b".repeat(64),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            2,
            2,
            true);
    ProductionTimelineView.Beat first =
        beat(chapterId, firstBeatId, 0, 0L, 30_000L, "c".repeat(64));
    ProductionTimelineView.Beat second =
        beat(chapterId, secondBeatId, 1, 30_000L, 60_000L, "d".repeat(64));
    return new ProductionTimelineView(
        projectId, storyVersionId, 60_000L, "16:9", true, List.of(chapter), List.of(first, second));
  }

  private static ProductionTimelineView.Beat beat(
      UUID chapterId, UUID visualBeatId, int beatIndex, long startMs, long endMs, String checksum) {
    return new ProductionTimelineView.Beat(
        chapterId,
        0,
        0,
        beatIndex,
        visualBeatId,
        "Beat " + (beatIndex + 1),
        "Visual intent",
        "NONE",
        "GENERATE_NEW",
        UUID.randomUUID(),
        "images/" + visualBeatId + ".png",
        100L,
        checksum,
        startMs,
        endMs,
        endMs - startMs,
        true);
  }
}
