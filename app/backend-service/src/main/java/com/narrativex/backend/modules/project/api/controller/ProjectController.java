package com.narrativex.backend.modules.project.api.controller;

import com.narrativex.backend.modules.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.modules.generation.application.response.JobResponse;
import com.narrativex.backend.modules.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.modules.project.api.request.CreateProjectRequest;
import com.narrativex.backend.modules.project.api.request.CreateStoryVersionRequest;
import com.narrativex.backend.modules.project.application.command.CreateProjectCommand;
import com.narrativex.backend.modules.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.modules.project.application.query.ProjectListQuery;
import com.narrativex.backend.modules.project.application.response.ProjectResponse;
import com.narrativex.backend.modules.project.application.response.StoryVersionResponse;
import com.narrativex.backend.modules.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.modules.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.modules.project.application.usecase.ListProjectsUseCase;
import com.narrativex.backend.shared.application.response.ApiResponse;
import com.narrativex.backend.shared.application.response.PaginationResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {
    private final ListProjectsUseCase listProjectsUseCase;
    private final CreateProjectUseCase createProjectUseCase;
    private final CreateStoryVersionUseCase createStoryVersionUseCase;
    private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;

    public ProjectController(ListProjectsUseCase listProjectsUseCase, CreateProjectUseCase createProjectUseCase,
            CreateStoryVersionUseCase createStoryVersionUseCase, EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase) {
        this.listProjectsUseCase = listProjectsUseCase;
        this.createProjectUseCase = createProjectUseCase;
        this.createStoryVersionUseCase = createStoryVersionUseCase;
        this.enqueueStoryAnalysisUseCase = enqueueStoryAnalysisUseCase;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PaginationResponse<ProjectResponse>>> list(
            @RequestHeader(name = "X-User-Id", required = false) String ownerId,
            @PageableDefault(page = 0, size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Pageable bounded = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100), pageable.getSort());
        ProjectListQuery query = new ProjectListQuery(ownerId, bounded);
        return ResponseEntity.ok(listProjectsUseCase.execute(query));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProjectResponse>> create(@Valid @RequestBody CreateProjectRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        CreateProjectCommand command = new CreateProjectCommand(request.name(), request.sourceLanguage(),
            request.narrationLanguage(), request.metadataLanguage(), request.imageAspectRatio(),
            request.imageQualityTier(), ownerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(createProjectUseCase.execute(command));
    }

    @PostMapping("/{projectId}/stories")
    public ResponseEntity<ApiResponse<StoryVersionResponse>> createStory(@PathVariable Long projectId,
            @Valid @RequestBody CreateStoryVersionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        CreateStoryVersionCommand command = new CreateStoryVersionCommand(projectId, request.content(),
            request.sourceLanguage(), request.rightsAttestationAccepted(), request.rightsPolicyVersion(),
            request.rightsBasis(), ownerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(createStoryVersionUseCase.execute(command));
    }

    @PostMapping("/{projectId}/analysis-jobs")
    public ResponseEntity<ApiResponse<JobResponse>> analyze(@PathVariable Long projectId,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        EnqueueStoryAnalysisCommand command = new EnqueueStoryAnalysisCommand(projectId, ownerId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(enqueueStoryAnalysisUseCase.execute(command));
    }
}
