package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.api.request.EstimateMediaJobRequest;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class EstimateMediaJobUseCaseTest {

  @Test
  void estimatesThroughTheAuthoritativeImageCatalog() {
    CurrentUserId currentUserId = () -> "user-1";
    var chapterAnalysisSourceAccess = mock(ChapterAnalysisSourceAccess.class);
    var mediaPlanningSourceAccess = mock(MediaPlanningSourceAccess.class);
    var imageGenerationCatalog = mock(ImageGenerationCatalog.class);
    when(mediaPlanningSourceAccess.requireCurrent(7L))
        .thenReturn(new MediaPlanningSource(List.of(scene(11L, 2), scene(12L, 1))));
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
            3L,
            7L,
            new EstimateMediaJobRequest("IMAGE_MOTION", "16:9", "HIGH", "CINEMATIC"));

    assertThat(response.data().visualBeatCount()).isEqualTo(3);
    assertThat(response.data().unitEstimatedCost()).isEqualTo("0.400000");
    assertThat(response.data().estimatedCost()).isEqualTo("1.200000");
    assertThat(response.data().currency()).isEqualTo("USD");
    verify(chapterAnalysisSourceAccess).requireOwnedForAnalysisLocked(3L, 7L, "user-1");
    verify(imageGenerationCatalog).resolve("HIGH");
  }

  private static MediaPlanningSource.SceneSnapshot scene(long sceneId, int beatCount) {
    var beats =
        java.util.stream.IntStream.range(0, beatCount)
            .mapToObj(
                index ->
                    new MediaPlanningSource.BeatSnapshot(
                        sceneId * 100 + index,
                        index,
                        "visual intent " + index,
                        MediaPlanningSource.MotionIntent.STILL))
            .toList();
    return new MediaPlanningSource.SceneSnapshot(sceneId, 0, "narration", 3, beats);
  }
}
