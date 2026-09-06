package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventStreamService;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/v1/generation-jobs", "/api/v1/jobs"})
public class GenerationJobController {
  private final GetGenerationJobUseCase getGenerationJobUseCase;
  private final GenerationJobEventStreamService generationJobEventStreamService;

  @GetMapping("/{jobId}")
  public ResponseEntity<ApiResponse<JobResponse>> get(@PathVariable UUID jobId) {
    var details =
        getGenerationJobUseCase.executeWithProgress(new GetGenerationJobQuery(jobId, null));
    return ResponseEntity.ok(
        ApiResponse.success(
            "Generation job retrieved successfully",
            JobResponse.fromWithAnalysisProgress(details.job(), details.analysisProgress())));
  }

  @GetMapping(path = "/{jobId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter events(@PathVariable UUID jobId) {
    return generationJobEventStreamService.subscribe(jobId);
  }
}
