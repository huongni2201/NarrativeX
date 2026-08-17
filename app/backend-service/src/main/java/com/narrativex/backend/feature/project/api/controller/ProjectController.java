package com.narrativex.backend.feature.project.api.controller;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.request.CreateProjectRequest;
import com.narrativex.backend.feature.project.api.request.CreateStoryVersionRequest;
import com.narrativex.backend.feature.project.api.response.ProjectResponse;
import com.narrativex.backend.feature.project.api.response.StoryVersionResponse;
import com.narrativex.backend.feature.project.application.command.CreateProjectCommand;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.query.ProjectListQuery;
import com.narrativex.backend.feature.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.feature.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.feature.project.application.usecase.ListProjectsUseCase;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {
    private final ListProjectsUseCase listProjectsUseCase;
    private final CreateProjectUseCase createProjectUseCase;
    private final CreateStoryVersionUseCase createStoryVersionUseCase;

    public ProjectController(
            ListProjectsUseCase listProjectsUseCase,
            CreateProjectUseCase createProjectUseCase,
            CreateStoryVersionUseCase createStoryVersionUseCase) {
        this.listProjectsUseCase = listProjectsUseCase;
        this.createProjectUseCase = createProjectUseCase;
        this.createStoryVersionUseCase = createStoryVersionUseCase;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<CursorPage<ProjectResponse>>> list(
            @RequestHeader(name = "X-User-Id", required = false) String ownerId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        ProjectListQuery query = new ProjectListQuery(ownerId, cursor, limit);
        return ResponseEntity.ok(listProjectsUseCase.execute(query));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProjectResponse>> create(
            @Valid @RequestBody CreateProjectRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        CreateProjectCommand command = new CreateProjectCommand(
            request.name(), request.sourceLanguage(), request.narrationLanguage(), request.metadataLanguage(),
            request.imageAspectRatio(), request.imageQualityTier(), ownerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(createProjectUseCase.execute(command));
    }

    @PostMapping("/{projectId}/stories")
    public ResponseEntity<ApiResponse<StoryVersionResponse>> createStory(
            @PathVariable Long projectId,
            @Valid @RequestBody CreateStoryVersionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        CreateStoryVersionCommand command = new CreateStoryVersionCommand(
            projectId, request.content(), request.sourceLanguage(), request.rightsAttestationAccepted(),
            request.rightsPolicyVersion(), request.rightsBasis(), ownerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(createStoryVersionUseCase.execute(command));
    }
}
