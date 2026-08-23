package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/v1/generation-jobs", "/api/v1/jobs"})
public class GenerationJobController {
  private final GetGenerationJobUseCase getGenerationJobUseCase;

  @GetMapping("/{jobId}")
  public ResponseEntity<ApiResponse<JobResponse>> get(@PathVariable UUID jobId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Generation job retrieved successfully",
            JobResponse.from(
                getGenerationJobUseCase.execute(new GetGenerationJobQuery(jobId, null)))));
  }
}
