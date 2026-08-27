package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.GeminiVisualContextResponse;
import com.narrativex.backend.feature.generation.application.usecase.GetGeminiVisualContextUseCase;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/scenes")
public class GeminiVisualContextController {
  private final GetGeminiVisualContextUseCase getGeminiVisualContextUseCase;

  @GetMapping("/{sceneId}/gemini-visual-context")
  public ResponseEntity<ApiResponse<GeminiVisualContextResponse>> getVisualContext(
      @PathVariable UUID projectId, @PathVariable UUID sceneId) {
    var context = getGeminiVisualContextUseCase.execute(projectId, sceneId);
    return ResponseEntity.ok(
        ApiResponse.success("Gemini visual continuity context retrieved", GeminiVisualContextResponse.from(context)));
  }
}
