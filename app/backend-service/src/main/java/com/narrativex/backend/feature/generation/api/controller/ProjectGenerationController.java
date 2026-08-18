package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects")
public class ProjectGenerationController {
  private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;

  @PostMapping("/{projectId}/chapters/{chapterId}/analysis-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(
      @PathVariable Long projectId, @PathVariable Long chapterId) {
    log.info("Requesting story analysis for chapter {} in project {}", chapterId, projectId);
    var job =
        enqueueStoryAnalysisUseCase.execute(new EnqueueStoryAnalysisCommand(projectId, chapterId));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Story analysis job accepted", JobResponse.from(job)));
  }
}
