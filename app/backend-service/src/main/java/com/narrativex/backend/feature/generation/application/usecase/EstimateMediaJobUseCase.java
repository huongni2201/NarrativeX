package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.EstimateMediaJobRequest;
import com.narrativex.backend.feature.generation.api.response.MediaCostEstimateResponse;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EstimateMediaJobUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterAnalysisSourceAccess chapterAnalysisSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final ImageGenerationCatalog imageGenerationCatalog;

  @Transactional(readOnly = true)
  public ApiResponse<MediaCostEstimateResponse> execute(
      Long projectId, Long chapterId, EstimateMediaJobRequest request) {
    chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(
        projectId, chapterId, currentUserId.get());
    int visualBeatCount =
        mediaPlanningSourceAccess.requireCurrent(chapterId).scenes().stream()
            .mapToInt(scene -> scene.beats().size())
            .sum();
    var imageProfile = imageGenerationCatalog.resolve(request.qualityTier());
    return ApiResponse.success(
        new MediaCostEstimateResponse(
            visualBeatCount,
            imageProfile.unitCostUsd().setScale(6).toPlainString(),
            imageProfile.estimateCost(visualBeatCount).toPlainString(),
            "USD"));
  }
}
