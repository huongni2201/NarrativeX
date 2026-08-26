package com.narrativex.backend.feature.render.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.render.api.response.FinalArtifactResponse;
import com.narrativex.backend.feature.render.application.usecase.GetFinalArtifactByJobUseCase;
import com.narrativex.backend.feature.render.application.usecase.GetFinalArtifactUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/artifacts")
public class FinalArtifactController {
  private final GetFinalArtifactUseCase getFinalArtifactUseCase;
  private final GetFinalArtifactByJobUseCase getFinalArtifactByJobUseCase;

  @GetMapping("/{artifactId}")
  public ResponseEntity<ApiResponse<FinalArtifactResponse>> get(@PathVariable Long artifactId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Final artifact retrieved successfully",
            FinalArtifactResponse.from(getFinalArtifactUseCase.execute(artifactId))));
  }

  @GetMapping("/by-job/{jobId}")
  public ResponseEntity<ApiResponse<FinalArtifactResponse>> getByJob(@PathVariable String jobId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Final artifact retrieved successfully",
            FinalArtifactResponse.from(getFinalArtifactByJobUseCase.execute(jobId))));
  }
}
