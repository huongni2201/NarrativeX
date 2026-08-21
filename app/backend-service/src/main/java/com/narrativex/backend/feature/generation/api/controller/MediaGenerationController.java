package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.api.request.CreateMediaJobRequest;
import com.narrativex.backend.feature.generation.api.request.ReviewMediaGenerationItemRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.MediaJobDetailsResponse;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.usecase.CreateMediaJobUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetMediaJobDetailsUseCase;
import com.narrativex.backend.feature.generation.application.usecase.ReviewMediaGenerationItemUseCase;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
  private final GetMediaJobDetailsUseCase getMediaJobDetailsUseCase;
  private final ReviewMediaGenerationItemUseCase reviewMediaGenerationItemUseCase;

  @PostMapping("/projects/{projectId}/chapters/{chapterId}/media-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> create(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @Valid @RequestBody CreateMediaJobRequest request,
      @RequestHeader("Idempotency-Key") String idempotencyKey) {
    var job = createMediaJobUseCase.execute(new CreateMediaJobCommand(projectId, chapterId, idempotencyKey, request.productionMode(), request.aspectRatio(), request.qualityTier(), request.maxAuthorizedCost()));
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success("Media job queued", JobResponse.from(job)));
  }

  @GetMapping("/media-jobs/{jobId}")
  public ResponseEntity<ApiResponse<MediaJobDetailsResponse>> details(@PathVariable String jobId) {
    return ResponseEntity.ok(ApiResponse.success("Media job details", getMediaJobDetailsUseCase.execute(jobId)));
  }

  @PostMapping("/media-generation-items/{itemId}/review")
  public ResponseEntity<ApiResponse<Void>> review(
      @PathVariable UUID itemId, @Valid @RequestBody ReviewMediaGenerationItemRequest request) {
    reviewMediaGenerationItemUseCase.execute(itemId, request.decision(), request.rowVersion());
    return ResponseEntity.ok(ApiResponse.success("Media generation item reviewed"));
  }
}
