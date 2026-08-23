package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.EstimateMediaJobRequest;
import com.narrativex.backend.feature.generation.api.response.MediaCostEstimateResponse;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EstimateMediaJobUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterAnalysisSourceAccess chapterAnalysisSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;

  @Transactional(readOnly = true)
  public ApiResponse<MediaCostEstimateResponse> execute(
      Long projectId, Long chapterId, EstimateMediaJobRequest request) {
    chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(
        projectId, chapterId, currentUserId.get());
    int visualBeatCount =
        mediaPlanningSourceAccess.requireCurrent(chapterId).scenes().stream()
            .mapToInt(scene -> scene.beats().size())
            .sum();
    BigDecimal unitCost = MediaCostEstimator.unitCost(request.qualityTier());
    BigDecimal estimatedCost = MediaCostEstimator.estimate(request.qualityTier(), visualBeatCount);
    return ApiResponse.success(
        new MediaCostEstimateResponse(
            visualBeatCount,
            unitCost.setScale(6).toPlainString(),
            estimatedCost.toPlainString(),
            "USD"));
  }
}
