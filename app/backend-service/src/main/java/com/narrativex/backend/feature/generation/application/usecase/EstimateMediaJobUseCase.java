package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.MediaCostEstimateResponse;
import com.narrativex.backend.feature.generation.application.command.EstimateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.generation.application.service.VisualAssetReuseResolver;
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
  public ApiResponse<MediaCostEstimateResponse> execute(EstimateMediaJobCommand command) {
    chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(
        command.projectId(), command.chapterId(), currentUserId.get());
    var planningSource = mediaPlanningSourceAccess.requireCurrent(command.chapterId());
    int generatedImageCount = VisualAssetReuseResolver.countGenerated(planningSource.scenes());
    var imageProfile = imageGenerationCatalog.resolve(command.qualityTier());
    return ApiResponse.success(
        new MediaCostEstimateResponse(
            generatedImageCount,
            imageProfile.unitCostUsd().setScale(6).toPlainString(),
            imageProfile.estimateCost(generatedImageCount).toPlainString(),
            "USD"));
  }
}
