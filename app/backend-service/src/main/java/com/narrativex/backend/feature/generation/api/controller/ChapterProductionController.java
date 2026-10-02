package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.GenerateShotTakeRequest;
import com.narrativex.backend.feature.generation.api.request.SelectTakeRequest;
import com.narrativex.backend.feature.generation.api.request.UpdateShotStrategyRequest;
import com.narrativex.backend.feature.generation.api.response.ChapterProductionResponse;
import com.narrativex.backend.feature.generation.api.response.ChapterProductionStatusResponse;
import com.narrativex.backend.feature.generation.api.response.TakeResponse;
import com.narrativex.backend.feature.generation.application.usecase.GenerateShotTakeUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetChapterProductionUseCase;
import com.narrativex.backend.feature.generation.application.usecase.SelectTakeUseCase;
import com.narrativex.backend.feature.generation.application.usecase.UpdateShotStrategyUseCase;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for authoritative Chapter production read model and Shot/Take actions. Powers the
 * Desktop Shotboard and Take review workflows.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}")
public class ChapterProductionController {
  private final GetChapterProductionUseCase getChapterProductionUseCase;
  private final GenerateShotTakeUseCase generateShotTakeUseCase;
  private final SelectTakeUseCase selectTakeUseCase;
  private final UpdateShotStrategyUseCase updateShotStrategyUseCase;

  @GetMapping("/chapters/{chapterId}/production")
  public ResponseEntity<ApiResponse<ChapterProductionResponse>> getProduction(
      @PathVariable UUID projectId, @PathVariable UUID chapterId) {
    ChapterProductionResponse response = getChapterProductionUseCase.execute(projectId, chapterId);
    return ResponseEntity.ok(ApiResponse.success(response));
  }

  @GetMapping("/chapters/{chapterId}/production/status")
  public ResponseEntity<ApiResponse<ChapterProductionStatusResponse>> getProductionStatus(
      @PathVariable UUID projectId, @PathVariable UUID chapterId) {
    ChapterProductionStatusResponse response =
        getChapterProductionUseCase.getStatus(projectId, chapterId);
    return ResponseEntity.ok(ApiResponse.success(response));
  }

  @PostMapping("/shots/{shotId}/takes")
  public ResponseEntity<ApiResponse<TakeResponse>> generateTake(
      @PathVariable UUID projectId,
      @PathVariable UUID shotId,
      @Valid @RequestBody(required = false) GenerateShotTakeRequest request) {
    TakeResponse response =
        generateShotTakeUseCase.execute(
            new com.narrativex.backend.feature.generation.application.command
                .GenerateShotTakeCommand(
                projectId,
                shotId,
                request != null ? request.strategy() : null,
                request != null ? request.seed() : null,
                request != null ? request.retryFromTakeId() : null,
                request != null ? request.retryReason() : null));
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(response));
  }

  @PutMapping("/shots/{shotId}/selected-take")
  public ResponseEntity<ApiResponse<SelectedTake>> selectTake(
      @PathVariable UUID projectId,
      @PathVariable UUID shotId,
      @Valid @RequestBody SelectTakeRequest request) {
    SelectedTake selected =
        selectTakeUseCase.execute(
            projectId, shotId, request.takeId(), request.sourceInMs(), request.sourceOutMs());
    return ResponseEntity.ok(ApiResponse.success("Selected take updated successfully", selected));
  }

  @PutMapping("/shots/{shotId}/strategy")
  public ResponseEntity<ApiResponse<Void>> updateStrategy(
      @PathVariable UUID projectId,
      @PathVariable UUID shotId,
      @Valid @RequestBody UpdateShotStrategyRequest request) {
    updateShotStrategyUseCase.execute(projectId, shotId, request.strategy());
    return ResponseEntity.ok(ApiResponse.success("Shot strategy updated successfully"));
  }
}
