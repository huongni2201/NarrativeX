package com.narrativex.backend.feature.project.api.controller;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.request.CreateProjectRequest;
import com.narrativex.backend.feature.project.api.request.CreateStoryVersionRequest;
import com.narrativex.backend.feature.project.api.response.ProjectResponse;
import com.narrativex.backend.feature.project.api.response.StoryVersionResponse;
import com.narrativex.backend.feature.project.application.command.CreateProjectCommand;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.query.GetProjectQuery;
import com.narrativex.backend.feature.project.application.query.ProjectListQuery;
import com.narrativex.backend.feature.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.feature.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.feature.project.application.usecase.GetProjectUseCase;
import com.narrativex.backend.feature.project.application.usecase.ListProjectsUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects")
public class ProjectController {
  private final ListProjectsUseCase listProjectsUseCase;
  private final GetProjectUseCase getProjectUseCase;
  private final CreateProjectUseCase createProjectUseCase;
  private final CreateStoryVersionUseCase createStoryVersionUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<CursorPage<ProjectResponse>>> list(
      @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit) {
    CursorPage<ProjectResponse> page =
        listProjectsUseCase.execute(new ProjectListQuery(null, cursor, limit)).map(ProjectResponse::from);
    return ResponseEntity.ok(ApiResponse.success("Projects retrieved successfully", page));
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ProjectResponse>> get(@PathVariable Long projectId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Project retrieved successfully",
            ProjectResponse.from(getProjectUseCase.execute(new GetProjectQuery(projectId)))));
  }

  @PostMapping
  public ResponseEntity<ApiResponse<ProjectResponse>> create(
      @Valid @RequestBody CreateProjectRequest request) {
    var command =
        new CreateProjectCommand(
            request.name(),
            request.sourceLanguage(),
            request.narrationLanguage(),
            request.metadataLanguage(),
            request.imageAspectRatio(),
            request.imageQualityTier(),
            null);
    log.debug("Creating project for authenticated principal");
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            ApiResponse.success(
                "Project created successfully", ProjectResponse.from(createProjectUseCase.execute(command))));
  }

  @PostMapping("/{projectId}/stories")
  public ResponseEntity<ApiResponse<StoryVersionResponse>> createStory(
      @PathVariable Long projectId, @Valid @RequestBody CreateStoryVersionRequest request) {
    var command =
        new CreateStoryVersionCommand(projectId, request.content(), request.sourceLanguage(), null);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            ApiResponse.success(
                "Story version created successfully",
                StoryVersionResponse.from(createStoryVersionUseCase.execute(command))));
  }
}
