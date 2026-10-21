package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.SelectVisualBeatImageAttemptRequest;
import com.narrativex.backend.feature.generation.application.usecase.SelectVisualBeatImageAttemptUseCase;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.usecase.AttachVisualBeatPreviewMediaUseCase;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(
    "/api/v1/projects/{projectId}/chapters/{chapterId}/visual-beats/{visualBeatId}/selected-image")
public class SelectedVisualBeatImageController {
  private final SelectVisualBeatImageAttemptUseCase selectAttemptUseCase;
  private final AttachVisualBeatPreviewMediaUseCase attachPreviewMediaUseCase;

  @PutMapping
  public ResponseEntity<ApiResponse<VisualBeatResponse>> select(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @PathVariable UUID visualBeatId,
      @Valid @RequestBody SelectVisualBeatImageAttemptRequest request) {
    var selection =
        selectAttemptUseCase.execute(projectId, chapterId, visualBeatId, request.itemId());
    var response =
        attachPreviewMediaUseCase.execute(
            projectId,
            chapterId,
            selection.sceneId(),
            visualBeatId,
            request.expectedVisualBeatRowVersion(),
            selection.mediaAssetId());
    return ResponseEntity.ok(response);
  }
}
