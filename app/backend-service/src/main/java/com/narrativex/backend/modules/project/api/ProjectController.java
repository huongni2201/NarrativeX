package com.narrativex.backend.modules.project.api;

import com.narrativex.backend.modules.generation.api.JobResponse;
import com.narrativex.backend.modules.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.modules.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.modules.project.api.CreateProjectRequest;
import com.narrativex.backend.modules.project.application.command.CreateProjectCommand;
import com.narrativex.backend.modules.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.modules.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.modules.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.modules.project.application.usecase.ListProjectsUseCase;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
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
    public List<ProjectResponse> list(@RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return listProjectsUseCase.execute(ownerId).stream().map(ProjectResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@Valid @RequestBody CreateProjectRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return ProjectResponse.from(createProjectUseCase.execute(new CreateProjectCommand(
                request.name(), request.sourceLanguage(), request.narrationLanguage(), request.metadataLanguage(),
                request.imageAspectRatio(), request.imageQualityTier()), ownerId));
    }

    @PostMapping("/{projectId}/stories")
    @ResponseStatus(HttpStatus.CREATED)
    public StoryVersionResponse createStory(@PathVariable Long projectId,
            @Valid @RequestBody CreateStoryVersionRequest request,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return StoryVersionResponse.from(createStoryVersionUseCase.execute(projectId, new CreateStoryVersionCommand(
                request.content(), request.sourceLanguage(), request.rightsAttestationAccepted(),
                request.rightsPolicyVersion(), request.rightsBasis()), ownerId));
    }

    @PostMapping("/{projectId}/analysis-jobs")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JobResponse analyze(@PathVariable Long projectId,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return JobResponse.from(enqueueStoryAnalysisUseCase.execute(
                new EnqueueStoryAnalysisCommand(projectId, ownerId)));
    }
}
