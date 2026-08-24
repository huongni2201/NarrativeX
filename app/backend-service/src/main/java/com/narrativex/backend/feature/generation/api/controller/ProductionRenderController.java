package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.CreateProjectRenderRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.ProductionTimelineResponse;
import com.narrativex.backend.feature.generation.api.response.ProjectRenderArtifactResponse;
import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import com.narrativex.backend.feature.generation.application.usecase.CreateProjectRenderUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetProductionTimelineUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetProjectRenderArtifactUseCase;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/production")
public class ProductionRenderController {
  private final GetProductionTimelineUseCase getProductionTimelineUseCase;
  private final CreateProjectRenderUseCase createProjectRenderUseCase;
  private final GetProjectRenderArtifactUseCase getProjectRenderArtifactUseCase;

  @Value("${narrativex.generation.media-enabled:false}")
  private boolean mediaGenerationEnabled;

  @GetMapping("/timeline")
  public ResponseEntity<ApiResponse<ProductionTimelineResponse>> timeline(
      @PathVariable UUID projectId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Production timeline loaded",
            ProductionTimelineResponse.from(getProductionTimelineUseCase.execute(projectId))));
  }

  @PostMapping("/render")
  public ResponseEntity<ApiResponse<JobResponse>> render(
      @PathVariable UUID projectId,
      @Valid @RequestBody CreateProjectRenderRequest request,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
    if (!mediaGenerationEnabled) {
      throw new FeatureNotAvailableException(
          "Project rendering is temporarily unavailable until its worker is enabled.");
    }
    var overrides =
        request.beatOverrides().stream()
            .map(
                override ->
                    new RenderBeatOverride(
                        override.visualBeatId(), override.durationMs(), override.cameraMovement()))
            .toList();
    var job =
        createProjectRenderUseCase.execute(
            new CreateProjectRenderCommand(
                projectId,
                request.resolution(),
                request.format(),
                request.maxAuthorizedCost(),
                idempotencyKey,
                overrides));
    return ResponseEntity.accepted()
        .body(ApiResponse.success("Project render queued", JobResponse.from(job)));
  }

  @GetMapping("/renders/by-job/{jobId}")
  public ResponseEntity<ApiResponse<ProjectRenderArtifactResponse>> artifactByJob(
      @PathVariable UUID projectId, @PathVariable UUID jobId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Project render artifact loaded",
            ProjectRenderArtifactResponse.from(
                getProjectRenderArtifactUseCase.execute(projectId, jobId))));
  }
}
