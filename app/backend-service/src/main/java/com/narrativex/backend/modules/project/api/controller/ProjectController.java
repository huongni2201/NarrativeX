package com.narrativex.backend.modules.project.api;

import com.narrativex.backend.modules.generation.api.JobResponse;
import com.narrativex.backend.modules.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.modules.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.modules.project.application.command.CreateProjectCommand;
import com.narrativex.backend.modules.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.modules.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.modules.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.modules.project.application.usecase.ListProjectsUseCase;
import com.narrativex.backend.shared.api.ApiResponse;
import com.narrativex.backend.shared.api.PaginationResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ListProjectsUseCase listProjectsUseCase;
    private final CreateProjectUseCase createProjectUseCase;
    private final CreateStoryVersionUseCase createStoryVersionUseCase;
    private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;

    public ProjectController(ListProjectsUseCase listProjectsUseCase, CreateProjectUseCase createProjectUseCase,
            CreateStoryVersionUseCase createStoryVersionUseCase,
            EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase) {
        this.listProjectsUseCase = listProjectsUseCase;
        this.createProjectUseCase = createProjectUseCase;
        this.createStoryVersionUseCase = createStoryVersionUseCase;
        this.enqueueStoryAnalysisUseCase = enqueueStoryAnalysisUseCase;
    }

    @GetMapping
    public ApiResponse<PaginationResponse<ProjectResponse>> list(
            @RequestHeader(name = "X-User-Id", required = false) String ownerId,
            @PageableDefault(page = 0, size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        Pageable boundedPageable = PageRequest.of(
            pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100), pageable.getSort());
        return ApiResponse.success("Projects retrieved successfully",
            PaginationResponse.from(listProjectsUseCase.execute(ownerId, boundedPageable), ProjectResponse::from));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody CreateProjectRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        ProjectResponse response = ProjectResponse.from(createProjectUseCase.execute(new CreateProjectCommand(
                request.name(), request.sourceLanguage(), request.narrationLanguage(), request.metadataLanguage(),
                request.imageAspectRatio(), request.imageQualityTier()), ownerId));
        return ApiResponse.success("Project created successfully", response);
    }

    @PostMapping("/{projectId}/stories")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<StoryVersionResponse> createStory(@PathVariable Long projectId,
            @Valid @RequestBody CreateStoryVersionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        StoryVersionResponse response = StoryVersionResponse.from(
            createStoryVersionUseCase.execute(projectId, new CreateStoryVersionCommand(
            request.content(), request.sourceLanguage(), request.rightsAttestationAccepted(),
                request.rightsPolicyVersion(), request.rightsBasis()), ownerId));
        return ApiResponse.success("Story version created successfully", response);
    }

    @PostMapping("/{projectId}/analysis-jobs")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ApiResponse<JobResponse> analyze(@PathVariable Long projectId,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return ApiResponse.success("Story analysis job queued", JobResponse.from(
            enqueueStoryAnalysisUseCase.execute(new EnqueueStoryAnalysisCommand(projectId, ownerId))));
    }
}
