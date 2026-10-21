package com.narrativex.backend.feature.storyboard.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.storyboard.api.request.ReplaceShotAudioCueAllocationsRequest;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocationSet;
import com.narrativex.backend.feature.storyboard.application.usecase.GetShotAudioCueAllocationsUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.ReplaceShotAudioCueAllocationsUseCase;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/shot-sequences/{sequenceId}/audio-cue-allocations")
public class ShotAudioCueAllocationController {
  private final GetShotAudioCueAllocationsUseCase getUseCase;
  private final ReplaceShotAudioCueAllocationsUseCase replaceUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<ShotAudioCueAllocationSet>> get(
      @PathVariable UUID projectId, @PathVariable UUID sequenceId) {
    return ResponseEntity.ok(ApiResponse.success(getUseCase.execute(projectId, sequenceId)));
  }

  @PutMapping
  public ResponseEntity<ApiResponse<ShotAudioCueAllocationSet>> replace(
      @PathVariable UUID projectId,
      @PathVariable UUID sequenceId,
      @Valid @RequestBody ReplaceShotAudioCueAllocationsRequest request) {
    var allocations =
        request.allocations().stream()
            .map(
                assignment ->
                    new ReplaceShotAudioCueAllocationsUseCase.Assignment(
                        assignment.audioCueId(), assignment.shotId()))
            .toList();
    return ResponseEntity.ok(
        ApiResponse.success(
            replaceUseCase.execute(
                projectId, sequenceId, request.expectedRowVersion(), allocations)));
  }
}
