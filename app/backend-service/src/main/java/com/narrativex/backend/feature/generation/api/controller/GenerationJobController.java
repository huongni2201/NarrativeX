package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/jobs")
public class GenerationJobController {
  private final GetGenerationJobUseCase getGenerationJobUseCase;

  @GetMapping("/{jobId}")
  public ResponseEntity<ApiResponse<JobResponse>> get(@PathVariable String jobId) {
    return ResponseEntity.ok(
        getGenerationJobUseCase.execute(new GetGenerationJobQuery(jobId, null)));
  }
}
