package com.narrativex.backend.feature.project.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.response.ProjectResourceResponse;
import com.narrativex.backend.feature.project.application.usecase.ListProjectResourcesUseCase;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}")
public class ProjectResourceController {
  private final ListProjectResourcesUseCase listProjectResourcesUseCase;

  @GetMapping("/locations")
  public ResponseEntity<ApiResponse<List<ProjectResourceResponse.Location>>> locations(
      @PathVariable Long projectId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Project locations retrieved successfully",
            listProjectResourcesUseCase.locations(projectId).stream()
                .map(ProjectResourceResponse.Location::from)
                .toList()));
  }

  @GetMapping("/assets")
  public ResponseEntity<ApiResponse<List<ProjectResourceResponse.Asset>>> assets(
      @PathVariable Long projectId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Project assets retrieved successfully",
            listProjectResourcesUseCase.assets(projectId).stream()
                .map(ProjectResourceResponse.Asset::from)
                .toList()));
  }
}
