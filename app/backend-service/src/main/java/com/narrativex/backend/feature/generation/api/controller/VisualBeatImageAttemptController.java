package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.CreateVisualBeatImageAttemptRequest;
import com.narrativex.backend.feature.generation.api.request.ReviewMediaGenerationItemRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.VisualBeatImageAttemptResponse;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.usecase.CreateMediaJobUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetVisualBeatImageAttemptsUseCase;
import com.narrativex.backend.feature.generation.application.usecase.ReviewVisualBeatImageAttemptUseCase;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping(
    "/api/v1/projects/{projectId}/chapters/{chapterId}/visual-beats/{visualBeatId}/image-attempts")
public class VisualBeatImageAttemptController {
  private final CreateMediaJobUseCase createMediaJobUseCase;
  private final GetVisualBeatImageAttemptsUseCase getAttemptsUseCase;
  private final ReviewVisualBeatImageAttemptUseCase reviewAttemptUseCase;

  @Value("${narrativex.generation.media-enabled:false}")
  private boolean mediaGenerationEnabled;

  @PostMapping
  public ResponseEntity<ApiResponse<JobResponse>> create(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @PathVariable UUID visualBeatId,
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      @Valid @RequestBody(required = false) CreateVisualBeatImageAttemptRequest request) {
    requireMediaGenerationEnabled();
    var command =
        new CreateMediaJobCommand(
            projectId,
            chapterId,
            idempotencyKey,
            "LEGACY_IMAGE",
            request == null ? null : request.aspectRatio(),
            ImageStyle.CINEMATIC,
            "IMAGE",
            "API",
            request == null ? null : request.expectedPromptRevision(),
            visualBeatId);
    var job = createMediaJobUseCase.execute(command);
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("VisualBeat image attempt queued", JobResponse.from(job)));
  }

  @GetMapping
  public ResponseEntity<ApiResponse<List<VisualBeatImageAttemptResponse>>> list(
      @PathVariable UUID projectId, @PathVariable UUID chapterId, @PathVariable UUID visualBeatId) {
    return ResponseEntity.ok(
        ApiResponse.success(getAttemptsUseCase.execute(projectId, chapterId, visualBeatId)));
  }

  @PostMapping("/{itemId}/review")
  public ResponseEntity<ApiResponse<Void>> review(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @PathVariable UUID visualBeatId,
      @PathVariable UUID itemId,
      @Valid @RequestBody ReviewMediaGenerationItemRequest request) {
    reviewAttemptUseCase.execute(
        projectId, chapterId, visualBeatId, itemId, request.decision(), request.rowVersion());
    return ResponseEntity.ok(ApiResponse.success("Image attempt reviewed"));
  }

  private void requireMediaGenerationEnabled() {
    if (!mediaGenerationEnabled) {
      throw new FeatureNotAvailableException(
          "Media generation is temporarily unavailable until its worker is enabled.");
    }
  }
}
