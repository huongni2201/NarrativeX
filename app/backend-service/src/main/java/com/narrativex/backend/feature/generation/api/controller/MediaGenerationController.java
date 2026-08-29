package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.CreateMediaJobRequest;
import com.narrativex.backend.feature.generation.api.request.EstimateMediaJobRequest;
import com.narrativex.backend.feature.generation.api.request.ReviewMediaGenerationItemRequest;
import com.narrativex.backend.feature.generation.api.response.CurrentMediaJobResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.MediaCostEstimateResponse;
import com.narrativex.backend.feature.generation.api.response.MediaJobDetailsResponse;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.usecase.CreateMediaJobUseCase;
import com.narrativex.backend.feature.generation.application.usecase.EstimateMediaJobUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetCurrentMediaJobUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetMediaJobDetailsUseCase;
import com.narrativex.backend.feature.generation.application.usecase.ReviewMediaGenerationItemUseCase;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class MediaGenerationController {
  private final CreateMediaJobUseCase createMediaJobUseCase;
  private final EstimateMediaJobUseCase estimateMediaJobUseCase;
  private final GetCurrentMediaJobUseCase getCurrentMediaJobUseCase;
  private final GetMediaJobDetailsUseCase getMediaJobDetailsUseCase;
  private final ReviewMediaGenerationItemUseCase reviewMediaGenerationItemUseCase;

  @Value("${narrativex.generation.media-enabled:false}")
  private boolean mediaGenerationEnabled;

  @PostMapping("/projects/{projectId}/chapters/{chapterId}/media-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> create(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @Valid @RequestBody CreateMediaJobRequest request,
      @RequestHeader("Idempotency-Key") String idempotencyKey) {
    requireMediaGenerationEnabled();
    var job =
        createMediaJobUseCase.execute(
            new CreateMediaJobCommand(
                projectId,
                chapterId,
                idempotencyKey,
                request.productionMode(),
                request.aspectRatio(),
                request.qualityTier(),
                request.maxAuthorizedCost(),
                ImageStyle.from(request.imageStyle()),
                request.effectiveVisualGenerationMode(),
                request.effectiveImageProvider()));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Media job queued", JobResponse.from(job)));
  }

  @PostMapping("/projects/{projectId}/chapters/{chapterId}/media-jobs/estimate")
  public ResponseEntity<ApiResponse<MediaCostEstimateResponse>> estimate(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @Valid @RequestBody EstimateMediaJobRequest request) {
    requireMediaGenerationEnabled();
    return ResponseEntity.ok(
        estimateMediaJobUseCase.execute(
            new com.narrativex.backend.feature.generation.application.command
                .EstimateMediaJobCommand(projectId, chapterId, request.qualityTier())));
  }

  @GetMapping("/projects/{projectId}/chapters/{chapterId}/media-jobs/current")
  public ResponseEntity<ApiResponse<CurrentMediaJobResponse>> current(
      @PathVariable UUID projectId, @PathVariable UUID chapterId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Current media job", getCurrentMediaJobUseCase.execute(projectId, chapterId)));
  }

  private void requireMediaGenerationEnabled() {
    if (!mediaGenerationEnabled) {
      throw new FeatureNotAvailableException(
          "Media generation is temporarily unavailable until its worker is enabled.");
    }
  }

  @GetMapping("/media-jobs/{jobId}")
  public ResponseEntity<ApiResponse<MediaJobDetailsResponse>> details(@PathVariable UUID jobId) {
    return ResponseEntity.ok(
        ApiResponse.success("Media job details", getMediaJobDetailsUseCase.execute(jobId)));
  }

  @PostMapping("/media-generation-items/{itemId}/review")
  public ResponseEntity<ApiResponse<Void>> review(
      @PathVariable UUID itemId, @Valid @RequestBody ReviewMediaGenerationItemRequest request) {
    reviewMediaGenerationItemUseCase.execute(itemId, request.decision(), request.rowVersion());
    return ResponseEntity.ok(ApiResponse.success("Media generation item reviewed"));
  }
}
