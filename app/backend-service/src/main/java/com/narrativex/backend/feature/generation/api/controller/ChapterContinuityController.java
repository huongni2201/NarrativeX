package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.ContinuityReviewRequest;
import com.narrativex.backend.feature.generation.api.request.CreateRegenerationJobRequest;
import com.narrativex.backend.feature.generation.api.request.CreateRegenerationPlanRequest;
import com.narrativex.backend.feature.generation.api.response.ChapterContinuityResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.RegenerationPlanResponse;
import com.narrativex.backend.feature.generation.application.service.ContinuityIssueCodec;
import com.narrativex.backend.feature.generation.application.usecase.CreateRegenerationJobUseCase;
import com.narrativex.backend.feature.generation.application.usecase.CreateRegenerationPlanUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetChapterContinuityUseCase;
import com.narrativex.backend.feature.generation.application.usecase.ReviewContinuityIssuesUseCase;
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
@RequestMapping("/api/v1/projects/{projectId}/chapters/{chapterId}")
public class ChapterContinuityController {
  private final GetChapterContinuityUseCase getChapterContinuityUseCase;
  private final CreateRegenerationPlanUseCase createRegenerationPlanUseCase;
  private final CreateRegenerationJobUseCase createRegenerationJobUseCase;
  private final ReviewContinuityIssuesUseCase reviewContinuityIssuesUseCase;
  private final ContinuityIssueCodec issueCodec;

  @GetMapping("/continuity")
  public ResponseEntity<ApiResponse<ChapterContinuityResponse>> getContinuity(
      @PathVariable UUID projectId, @PathVariable UUID chapterId) {
    var continuity = getChapterContinuityUseCase.execute(projectId, chapterId);
    return ResponseEntity.ok(
        ApiResponse.success(
            "Chapter continuity retrieved",
            ChapterContinuityResponse.from(continuity, issueCodec)));
  }

  @PostMapping("/regeneration-plans")
  public ResponseEntity<ApiResponse<RegenerationPlanResponse>> createRegenerationPlan(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @Valid @RequestBody CreateRegenerationPlanRequest request) {
    var plan =
        createRegenerationPlanUseCase.execute(
            projectId, chapterId, request.expectedPlanId(), request.beatIds(), request.reason());
    return ResponseEntity.ok(
        ApiResponse.success("Regeneration plan created", RegenerationPlanResponse.from(plan)));
  }

  @PostMapping("/regeneration-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> createRegenerationJob(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      @Valid @RequestBody CreateRegenerationJobRequest request) {
    var job =
        createRegenerationJobUseCase.execute(
            projectId, chapterId, request.regenerationPlanId(), idempotencyKey);
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Regeneration job accepted", JobResponse.from(job)));
  }

  @PostMapping("/continuity-reviews")
  public ResponseEntity<ApiResponse<ChapterContinuityResponse>> reviewContinuity(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @Valid @RequestBody ContinuityReviewRequest request) {
    var continuity =
        reviewContinuityIssuesUseCase.execute(
            projectId, chapterId, request.planId(), request.reportRevision(), request.issueIds());
    return ResponseEntity.ok(
        ApiResponse.success(
            "Continuity warnings acknowledged",
            ChapterContinuityResponse.from(continuity, issueCodec)));
  }
}
