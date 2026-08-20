package com.narrativex.backend.feature.project.api.controller;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.response.ProjectResourceResponse;
import com.narrativex.backend.feature.project.application.usecase.ListProjectResourcesUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}")
public class ProjectResourceController {
  private final ListProjectResourcesUseCase listProjectResourcesUseCase;

  @GetMapping("/locations")
  public ResponseEntity<ApiResponse<CursorPage<ProjectResourceResponse.Location>>> locations(
      @PathVariable Long projectId,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    CursorPage<ProjectResourceResponse.Location> page =
        listProjectResourcesUseCase
            .locations(projectId, cursor, limit)
            .map(ProjectResourceResponse.Location::from);
    return ResponseEntity.ok(ApiResponse.success("Project locations retrieved successfully", page));
  }

  @GetMapping("/assets")
  public ResponseEntity<ApiResponse<CursorPage<ProjectResourceResponse.Asset>>> assets(
      @PathVariable Long projectId,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    CursorPage<ProjectResourceResponse.Asset> page =
        listProjectResourcesUseCase
            .assets(projectId, cursor, limit)
            .map(ProjectResourceResponse.Asset::from);
    return ResponseEntity.ok(ApiResponse.success("Project assets retrieved successfully", page));
  }
}
