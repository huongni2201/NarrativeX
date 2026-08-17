package com.narrativex.backend.modules.project.api;

import com.narrativex.backend.modules.generation.api.JobResponse;
import com.narrativex.backend.modules.generation.application.GenerationApplicationService;
import com.narrativex.backend.modules.project.application.CreateProjectCommand;
import com.narrativex.backend.modules.project.application.CreateStoryVersionCommand;
import com.narrativex.backend.modules.project.application.ProjectApplicationService;
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

    private final ProjectApplicationService projectService;
    private final GenerationApplicationService generationService;

    public ProjectController(ProjectApplicationService projectService, GenerationApplicationService generationService) {
        this.projectService = projectService;
        this.generationService = generationService;
    }

    @GetMapping
    public List<ProjectResponse> list(@RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return projectService.listProjects(ownerId).stream().map(ProjectResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@Valid @RequestBody CreateProjectRequest request,
                                  @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return ProjectResponse.from(projectService.createProject(new CreateProjectCommand(
            request.name(), request.sourceLanguage(), request.narrationLanguage(), request.metadataLanguage(),
            request.imageAspectRatio(), request.imageQualityTier()), ownerId));
    }

    @PostMapping("/{projectId}/stories")
    @ResponseStatus(HttpStatus.CREATED)
    public StoryVersionResponse createStory(@PathVariable Long projectId,
                                            @Valid @RequestBody CreateStoryVersionRequest request,
                                            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return StoryVersionResponse.from(projectService.createStory(projectId, new CreateStoryVersionCommand(
            request.content(), request.sourceLanguage(), request.rightsAttestationAccepted(),
            request.rightsPolicyVersion(), request.rightsBasis()), ownerId));
    }

    @PostMapping("/{projectId}/analysis-jobs")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JobResponse analyze(@PathVariable Long projectId,
                               @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return JobResponse.from(generationService.enqueueStoryAnalysis(projectId, ownerId));
    }
}
