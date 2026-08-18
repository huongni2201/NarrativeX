package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectGenerationController {
  private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;
  private final boolean storyAnalysisEnabled;

  public ProjectGenerationController(
      EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase,
      @Value("${narrativex.features.story-analysis-enabled:false}") boolean storyAnalysisEnabled) {
    this.enqueueStoryAnalysisUseCase = enqueueStoryAnalysisUseCase;
    this.storyAnalysisEnabled = storyAnalysisEnabled;
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/analysis-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(
      @PathVariable Long projectId, @PathVariable Long chapterId) {
    if (!storyAnalysisEnabled) {
      throw new FeatureNotAvailableException(
          "Story analysis is temporarily unavailable until durable execution is enabled.");
    }
    log.info("Enqueueing story analysis for chapter {} in project {}", chapterId, projectId);
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(
            enqueueStoryAnalysisUseCase.execute(
                new EnqueueStoryAnalysisCommand(projectId, chapterId)));
  }
}
