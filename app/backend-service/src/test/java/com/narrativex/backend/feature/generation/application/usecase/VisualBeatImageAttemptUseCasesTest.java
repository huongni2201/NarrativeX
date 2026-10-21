package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationExecutionStatus;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationReviewStatus;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VisualBeatImageAttemptUseCasesTest {
  private final ChapterAnalysisSourceAccess chapterSource = mock(ChapterAnalysisSourceAccess.class);
  private final MediaPlanningSourceAccess planningSource = mock(MediaPlanningSourceAccess.class);
  private final GenerationJobRepository jobs = mock(GenerationJobRepository.class);
  private final MediaGenerationItemRepository items = mock(MediaGenerationItemRepository.class);
  private final StoryboardProductionAccess storyboard = mock(StoryboardProductionAccess.class);
  private final ReviewVisualBeatImageAttemptUseCase reviewUseCase =
      new ReviewVisualBeatImageAttemptUseCase(chapterSource, planningSource, jobs, items);
  private final SelectVisualBeatImageAttemptUseCase selectUseCase =
      new SelectVisualBeatImageAttemptUseCase(
          chapterSource, planningSource, jobs, items, storyboard);

  @Test
  void reviewIsProjectAndRevisionScoped() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID beatId = UUID.randomUUID();
    UUID revisionId = UUID.randomUUID();
    UUID itemId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(planningSource.requireCurrent(chapterId)).thenReturn(currentSource(beatId, revisionId));
    when(items.findById(itemId)).thenReturn(Optional.of(item(itemId, jobId, beatId)));
    var attemptJob = job(projectId, chapterId, revisionId);
    when(jobs.findById(jobId)).thenReturn(Optional.of(attemptJob));
    when(items.review(itemId, 1L, "APPROVED")).thenReturn(true);

    reviewUseCase.execute(projectId, chapterId, beatId, itemId, "APPROVED", 1L);

    verify(items).review(itemId, 1L, "APPROVED");
  }

  @Test
  void approvalOfImageFromOldStoryboardRevisionIsBlocked() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID beatId = UUID.randomUUID();
    UUID itemId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(planningSource.requireCurrent(chapterId))
        .thenReturn(currentSource(beatId, UUID.randomUUID()));
    when(items.findById(itemId)).thenReturn(Optional.of(item(itemId, jobId, beatId)));
    var oldRevisionJob = job(projectId, chapterId, UUID.randomUUID());
    when(jobs.findById(jobId)).thenReturn(Optional.of(oldRevisionJob));

    assertThatThrownBy(
            () -> reviewUseCase.execute(projectId, chapterId, beatId, itemId, "APPROVED", 1L))
        .isInstanceOfSatisfying(
            GenerationAdmissionDeniedException.class,
            denied -> assertThat(denied.getCode()).isEqualTo("STALE_STORYBOARD_REVISION"));
    verify(items, never()).review(itemId, 1L, "APPROVED");
  }

  @Test
  void imageSelectionRequiresApprovedReadyCandidateFromCurrentRevision() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID beatId = UUID.randomUUID();
    UUID revisionId = UUID.randomUUID();
    UUID itemId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    UUID sceneId = UUID.randomUUID();
    when(planningSource.requireCurrent(chapterId)).thenReturn(currentSource(beatId, revisionId));
    when(items.findById(itemId)).thenReturn(Optional.of(item(itemId, jobId, beatId, assetId)));
    var attemptJob = job(projectId, chapterId, revisionId);
    when(jobs.findById(jobId)).thenReturn(Optional.of(attemptJob));
    when(storyboard.findVisualBeat(beatId))
        .thenReturn(
            Optional.of(
                new StoryboardProductionAccess.VisualBeatInfo(
                    beatId,
                    sceneId,
                    UUID.randomUUID(),
                    1,
                    "Beat",
                    "intent",
                    "APPROVED",
                    null,
                    "intent")));

    var selected = selectUseCase.execute(projectId, chapterId, beatId, itemId);

    assertThat(selected.sceneId()).isEqualTo(sceneId);
    assertThat(selected.mediaAssetId()).isEqualTo(assetId);
  }

  @Test
  void imageSelectionRejectsUnreviewedCandidate() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID beatId = UUID.randomUUID();
    UUID revisionId = UUID.randomUUID();
    UUID itemId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(planningSource.requireCurrent(chapterId)).thenReturn(currentSource(beatId, revisionId));
    when(items.findById(itemId))
        .thenReturn(Optional.of(item(itemId, jobId, beatId, UUID.randomUUID(), false)));
    var attemptJob = job(projectId, chapterId, revisionId);
    when(jobs.findById(jobId)).thenReturn(Optional.of(attemptJob));

    assertThatThrownBy(() -> selectUseCase.execute(projectId, chapterId, beatId, itemId))
        .isInstanceOfSatisfying(
            GenerationAdmissionDeniedException.class,
            denied -> assertThat(denied.getCode()).isEqualTo("IMAGE_ATTEMPT_NOT_APPROVED"));
  }

  private static MediaPlanningSource currentSource(UUID beatId, UUID revisionId) {
    return new MediaPlanningSource(
        List.of(
            new MediaPlanningSource.SceneSnapshot(
                UUID.randomUUID(),
                0,
                "Scene",
                10,
                List.of(
                    new MediaPlanningSource.BeatSnapshot(
                        beatId, 0, "Beat", MediaPlanningSource.MotionIntent.STILL)))),
        revisionId,
        "source-hash",
        null,
        null);
  }

  private static GenerationJob job(UUID projectId, UUID chapterId, UUID revisionId) {
    GenerationJob job = mock(GenerationJob.class);
    when(job.getProjectId()).thenReturn(projectId);
    when(job.getChapterId()).thenReturn(chapterId);
    when(job.getStoryboardRevisionId()).thenReturn(revisionId);
    return job;
  }

  private static MediaGenerationItem item(UUID id, UUID jobId, UUID beatId) {
    return item(id, jobId, beatId, UUID.randomUUID());
  }

  private static MediaGenerationItem item(UUID id, UUID jobId, UUID beatId, UUID assetId) {
    return item(id, jobId, beatId, assetId, true);
  }

  private static MediaGenerationItem item(
      UUID id, UUID jobId, UUID beatId, UUID assetId, boolean approved) {
    return MediaGenerationItem.rehydrate(
        id,
        1L,
        jobId,
        UUID.randomUUID(),
        beatId,
        "beat-" + beatId,
        1,
        MediaGenerationExecutionStatus.READY,
        null,
        assetId,
        "f".repeat(64),
        null,
        null,
        approved ? MediaGenerationReviewStatus.APPROVED : MediaGenerationReviewStatus.NEEDS_REVIEW,
        null,
        null,
        0,
        null,
        null,
        null,
        null);
  }
}
