package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationExecutionStatus;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationReviewStatus;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetVisualBeatImageAttemptsUseCaseTest {
  private final ChapterAnalysisSourceAccess chapterSource = mock(ChapterAnalysisSourceAccess.class);
  private final MediaPlanningSourceAccess planningSourceAccess =
      mock(MediaPlanningSourceAccess.class);
  private final GenerationJobRepository jobs = mock(GenerationJobRepository.class);
  private final MediaGenerationItemRepository items = mock(MediaGenerationItemRepository.class);
  private final GetVisualBeatImageAttemptsUseCase useCase =
      new GetVisualBeatImageAttemptsUseCase(chapterSource, planningSourceAccess, jobs, items);

  @Test
  void returnsBeatHistoryWithRevisionAndReviewState() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID jobInternalId = UUID.randomUUID();
    UUID publicJobId = UUID.randomUUID();
    UUID planId = UUID.randomUUID();
    UUID revisionId = UUID.randomUUID();
    UUID itemId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    when(planningSourceAccess.requireCurrent(chapterId))
        .thenReturn(
            new MediaPlanningSource(
                List.of(
                    new MediaPlanningSource.SceneSnapshot(
                        UUID.randomUUID(),
                        0,
                        "Scene",
                        5,
                        List.of(
                            new MediaPlanningSource.BeatSnapshot(
                                visualBeatId,
                                0,
                                "Visual intent",
                                MediaPlanningSource.MotionIntent.STILL)))),
                revisionId,
                "source-hash",
                null,
                null));
    MediaGenerationItem item =
        MediaGenerationItem.rehydrate(
            itemId,
            2L,
            jobInternalId,
            planId,
            visualBeatId,
            "beat-" + visualBeatId,
            1,
            MediaGenerationExecutionStatus.READY,
            null,
            assetId,
            "f".repeat(64),
            null,
            null,
            MediaGenerationReviewStatus.APPROVED,
            null,
            null,
            0,
            null,
            null,
            null,
            null);
    when(items.findByVisualBeatId(projectId, chapterId, visualBeatId)).thenReturn(List.of(item));
    GenerationJob job = mock(GenerationJob.class);
    when(job.getJobId()).thenReturn(publicJobId);
    when(job.getStoryboardRevisionId()).thenReturn(revisionId);
    when(jobs.findById(jobInternalId)).thenReturn(Optional.of(job));

    var result = useCase.execute(projectId, chapterId, visualBeatId);

    assertThat(result).hasSize(1);
    assertThat(result.getFirst().jobId()).isEqualTo(publicJobId);
    assertThat(result.getFirst().mediaAssetId()).isEqualTo(assetId);
    assertThat(result.getFirst().reviewStatus()).isEqualTo("APPROVED");
    assertThat(result.getFirst().currentStoryboardRevision()).isTrue();
  }

  @Test
  void rejectsBeatOutsideCurrentChapterSnapshot() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    when(planningSourceAccess.requireCurrent(chapterId))
        .thenReturn(new MediaPlanningSource(List.of()));

    assertThatThrownBy(() -> useCase.execute(projectId, chapterId, UUID.randomUUID()))
        .isInstanceOf(ResourceNotFoundException.class)
        .hasMessageContaining("VisualBeat not found in chapter");
  }
}
