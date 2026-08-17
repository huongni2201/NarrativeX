package com.narrativex.backend.modules.project.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.modules.generation.domain.model.GenerationJob;
import com.narrativex.backend.modules.generation.domain.model.JobStatus;
import com.narrativex.backend.modules.generation.domain.model.JobType;
import com.narrativex.backend.modules.generation.domain.model.ResourceClass;
import com.narrativex.backend.modules.project.application.command.CreateProjectCommand;
import com.narrativex.backend.modules.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.modules.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.modules.project.application.usecase.ListProjectsUseCase;
import com.narrativex.backend.modules.project.domain.model.AspectRatio;
import com.narrativex.backend.modules.project.domain.model.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.modules.project.domain.model.ProjectStatus;
import com.narrativex.backend.shared.api.ApiResponse;
import com.narrativex.backend.shared.api.PaginationResponse;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

class ProjectControllerContractTest {

    private final ListProjectsUseCase listProjectsUseCase = mock(ListProjectsUseCase.class);
    private final CreateProjectUseCase createProjectUseCase = mock(CreateProjectUseCase.class);
    private final CreateStoryVersionUseCase createStoryVersionUseCase = mock(CreateStoryVersionUseCase.class);
    private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase = mock(EnqueueStoryAnalysisUseCase.class);
    private ProjectController controller;
    private Project project;

    @BeforeEach
    void setUp() {
        controller = new ProjectController(listProjectsUseCase, createProjectUseCase,
            createStoryVersionUseCase, enqueueStoryAnalysisUseCase);
        project = Project.rehydrate(7L, 3L, "Story", "owner", ProjectStatus.DRAFT,
            "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);
    }

    @Test
    void listUsesPaginatedEnvelopeAndCapsRequestedPageSize() {
        when(listProjectsUseCase.execute(eq("owner"), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(project), PageRequest.of(0, 20), 1));

        ApiResponse<PaginationResponse<ProjectResponse>> response = controller.list("owner", PageRequest.of(0, 500));

        assertTrue(response.success());
        assertEquals("Projects retrieved successfully", response.message());
        assertEquals(List.of(7L), response.data().content().stream().map(ProjectResponse::id).toList());
        assertEquals(1, response.data().totalElements());
        verify(listProjectsUseCase).execute(eq("owner"), eq(PageRequest.of(0, 100)));
    }

    @Test
    void createReturnsEnvelopeAndKeeps201() throws NoSuchMethodException {
        when(createProjectUseCase.execute(any(CreateProjectCommand.class), eq("owner"))).thenReturn(project);

        ApiResponse<ProjectResponse> response = controller.create(
            new CreateProjectRequest("Story", null, null, null, null, null), "owner");

        assertTrue(response.success());
        assertEquals(7L, response.data().id());
        assertEquals(HttpStatus.CREATED, ProjectController.class
            .getDeclaredMethod("create", CreateProjectRequest.class, String.class)
            .getAnnotation(ResponseStatus.class).value());
    }

    @Test
    void analysisReturnsEnvelopeAndKeeps202() throws NoSuchMethodException {
        GenerationJob job = GenerationJob.rehydrate(9L, 0L, "job-1", 7L, JobType.STORY_ANALYZE,
            JobStatus.QUEUED, ResourceClass.PROVIDER_INTERACTIVE, 0, "QUEUED", null, "owner", "owner");
        when(enqueueStoryAnalysisUseCase.execute(any())).thenReturn(job);

        ApiResponse<com.narrativex.backend.modules.generation.api.JobResponse> response =
            controller.analyze(7L, "owner");

        assertTrue(response.success());
        assertEquals("job-1", response.data().jobId());
        assertEquals(HttpStatus.ACCEPTED, ProjectController.class
            .getDeclaredMethod("analyze", Long.class, String.class)
            .getAnnotation(ResponseStatus.class).value());
    }
}
