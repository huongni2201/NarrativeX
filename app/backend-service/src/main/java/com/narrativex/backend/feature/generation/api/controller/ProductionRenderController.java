package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.CreateProjectRenderRequest;
import com.narrativex.backend.feature.generation.api.request.UpdateProductionBeatMediaRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.ProductionTimelineResponse;
import com.narrativex.backend.feature.generation.api.response.ProjectRenderArtifactResponse;
import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import com.narrativex.backend.feature.generation.application.usecase.CreateProjectRenderUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetProductionTimelineUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetProjectRenderArtifactUseCase;
import com.narrativex.backend.feature.generation.application.usecase.UpdateProductionBeatMediaUseCase;
import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import com.narrativex.backend.feature.generation.domain.enums.RenderExecutionTarget;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
  private final UpdateProductionBeatMediaUseCase updateProductionBeatMediaUseCase;

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

  @PutMapping("/beats/{visualBeatId}/media")
  public ResponseEntity<ApiResponse<Void>> updateBeatMedia(
      @PathVariable UUID projectId,
      @PathVariable UUID visualBeatId,
      @Valid @RequestBody UpdateProductionBeatMediaRequest request) {
    updateProductionBeatMediaUseCase.update(
        projectId,
        visualBeatId,
        request.mediaAssetId(),
        request.fitMode(),
        request.normalizedTrimStartMs());
    return ResponseEntity.ok(ApiResponse.success("Visual beat media updated"));
  }

  @DeleteMapping("/beats/{visualBeatId}/media")
  public ResponseEntity<ApiResponse<Void>> resetBeatMedia(
      @PathVariable UUID projectId, @PathVariable UUID visualBeatId) {
    updateProductionBeatMediaUseCase.clear(projectId, visualBeatId);
    return ResponseEntity.ok(ApiResponse.success("Visual beat media reset to generated source"));
  }

  @PostMapping("/render")
  public ResponseEntity<ApiResponse<JobResponse>> render(
      @PathVariable UUID projectId,
      @Valid @RequestBody CreateProjectRenderRequest request,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
    RenderExecutionTarget executionTarget = RenderExecutionTarget.valueOf(request.executionTarget());
    if (!mediaGenerationEnabled && executionTarget == RenderExecutionTarget.CLOUD) {
      throw new FeatureNotAvailableException(
          "Cloud project rendering is temporarily unavailable until its worker is enabled.");
    }

    applyAutoEditMediaOverrides(projectId, request.beatOverrides());
    var overrides =
        request.beatOverrides().stream()
            .map(
                override ->
                    new RenderBeatOverride(
                        override.visualBeatId(),
                        override.durationMs(),
                        override.cameraMovement(),
                        override.fitMode(),
                        override.trimStartMs()))
            .toList();
    var job =
        createProjectRenderUseCase.execute(
            new CreateProjectRenderCommand(
                projectId,
                request.resolution(),
                request.format(),
                request.maxAuthorizedCost(),
                idempotencyKey,
                executionTarget,
                request.localDeviceId(),
                overrides));
    return ResponseEntity.accepted()
        .body(ApiResponse.success("Project render queued", JobResponse.from(job)));
  }

  private void applyAutoEditMediaOverrides(
      UUID projectId, List<CreateProjectRenderRequest.BeatOverride> overrides) {
    if (overrides.stream().noneMatch(value -> value.fitMode() != null || value.trimStartMs() != null)) {
      return;
    }

    var timeline = getProductionTimelineUseCase.execute(projectId);
    for (var override : overrides) {
      if (override.fitMode() == null && override.trimStartMs() == null) continue;
      var beat =
          timeline.beats().stream()
              .filter(value -> value.visualBeatId().equals(override.visualBeatId()))
              .findFirst()
              .orElseThrow(
                  () ->
                      new GenerationAdmissionDeniedException(
                          "INVALID_RENDER_OVERRIDE",
                          "Auto Edit references a visual beat outside the current production timeline."));
      if (beat.mediaAssetId() == null) {
        throw new GenerationAdmissionDeniedException(
            "INVALID_RENDER_OVERRIDE", "Auto Edit cannot fit a beat without a selected media asset.");
      }
      BeatMediaFitMode fitMode =
          override.fitMode() == null
              ? BeatMediaFitMode.valueOf(beat.fitMode())
              : BeatMediaFitMode.valueOf(override.fitMode());
      long trimStartMs =
          override.trimStartMs() == null ? beat.trimStartMs() : override.trimStartMs();
      updateProductionBeatMediaUseCase.update(
          projectId, override.visualBeatId(), beat.mediaAssetId(), fitMode, trimStartMs);
    }
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
