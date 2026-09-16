package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventStreamService;
import com.narrativex.backend.feature.generation.application.usecase.CancelGenerationJobUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Slf4j
@RestController
@RequestMapping({"/api/v1/generation-jobs", "/api/v1/jobs"})
public class GenerationJobController {
  private final GetGenerationJobUseCase getGenerationJobUseCase;
  private final GenerationJobEventStreamService generationJobEventStreamService;
  private final CancelGenerationJobUseCase cancelGenerationJobUseCase;

  public GenerationJobController(
      GetGenerationJobUseCase getGenerationJobUseCase,
      GenerationJobEventStreamService generationJobEventStreamService,
      CancelGenerationJobUseCase cancelGenerationJobUseCase) {
    this.getGenerationJobUseCase = getGenerationJobUseCase;
    this.generationJobEventStreamService = generationJobEventStreamService;
    this.cancelGenerationJobUseCase = cancelGenerationJobUseCase;
  }

  @GetMapping("/{jobId}")
  public ResponseEntity<ApiResponse<JobResponse>> get(@PathVariable UUID jobId) {
    var details = getGenerationJobUseCase.executeWithProgress(new GetGenerationJobQuery(jobId));
    return ResponseEntity.ok(
        ApiResponse.success(
            "Generation job retrieved successfully",
            JobResponse.fromWithAnalysisProgress(details.job(), details.analysisProgress())));
  }

  @GetMapping(path = "/{jobId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter events(@PathVariable UUID jobId) {
    return generationJobEventStreamService.subscribe(jobId);
  }

  @PostMapping("/{jobId}:cancel")
  public ResponseEntity<ApiResponse<JobResponse>> cancel(@PathVariable UUID jobId) {
    GenerationJob canceled = cancelGenerationJobUseCase.execute(jobId);
    return ResponseEntity.ok(
        ApiResponse.success("Generation job cancellation requested", JobResponse.from(canceled)));
  }
}
