package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects")
public class ProjectGenerationController {
  private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;

  @PostMapping("/{projectId}/analysis-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> analyze(@PathVariable Long projectId) {
    log.info("Enqueueing story analysis for project {}", projectId);
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(
            enqueueStoryAnalysisUseCase.execute(new EnqueueStoryAnalysisCommand(projectId, null)));
  }
}
