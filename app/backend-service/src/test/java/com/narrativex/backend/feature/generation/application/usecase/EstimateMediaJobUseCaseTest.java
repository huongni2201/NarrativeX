package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.command.EstimateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EstimateMediaJobUseCaseTest {

  @Test
  void estimatesThroughTheAuthoritativeImageCatalog() {
    CurrentUserId currentUserId = () -> "user-1";
    var chapterAnalysisSourceAccess = mock(ChapterAnalysisSourceAccess.class);
    var mediaPlanningSourceAccess = mock(MediaPlanningSourceAccess.class);
    var imageGenerationCatalog = mock(ImageGenerationCatalog.class);
    UUID projectId = UuidV7.random();
    UUID chapterId = UuidV7.random();

    when(mediaPlanningSourceAccess.requireCurrent(chapterId))
        .thenReturn(new MediaPlanningSource(List.of(scene(UuidV7.random(), 2), scene(UuidV7.random(), 1))));
    when(imageGenerationCatalog.resolve("HIGH"))
        .thenReturn(
            new ImageGenerationCatalog.ImageGenerationProfile(
                "vertex",
                "gemini-image",
                new BigDecimal("0.40"),
                "{}",
                "pricing-fingerprint"));

    var useCase =
        new EstimateMediaJobUseCase(
            currentUserId,
            chapterAnalysisSourceAccess,
            mediaPlanningSourceAccess,
            imageGenerationCatalog);

    var response =
        useCase.execute(
            new EstimateMediaJobCommand(projectId, chapterId, "HIGH"));

    assertThat(response.data().visualBeatCount()).isEqualTo(3);
    assertThat(response.data().unitEstimatedCost()).isEqualTo("0.400000");
    assertThat(response.data().estimatedCost()).isEqualTo("1.200000");
    assertThat(response.data().currency()).isEqualTo("USD");
    verify(chapterAnalysisSourceAccess).requireOwnedForAnalysisLocked(projectId, chapterId, "user-1");
    verify(imageGenerationCatalog).resolve("HIGH");
  }

  private static MediaPlanningSource.SceneSnapshot scene(UUID sceneId, int beatCount) {
    var beats =
        java.util.stream.IntStream.range(0, beatCount)
            .mapToObj(
                index ->
                    new MediaPlanningSource.BeatSnapshot(
                        UuidV7.random(),
                        index,
                        "visual intent " + index,
                        MediaPlanningSource.MotionIntent.STILL))
            .toList();
    return new MediaPlanningSource.SceneSnapshot(sceneId, 0, "narration", 3, beats);
  }
}
