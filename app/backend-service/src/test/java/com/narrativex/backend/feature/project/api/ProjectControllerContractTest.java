package com.narrativex.backend.feature.project.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.controller.ProjectController;
import com.narrativex.backend.feature.project.api.request.CreateProjectRequest;
import com.narrativex.backend.feature.project.api.response.ProjectResponse;
import com.narrativex.backend.feature.project.application.command.CreateProjectCommand;
import com.narrativex.backend.feature.project.application.query.ProjectListQuery;
import com.narrativex.backend.feature.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.feature.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.feature.project.application.usecase.ListProjectsUseCase;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ProjectControllerContractTest {
    private final ListProjectsUseCase listProjectsUseCase = mock(ListProjectsUseCase.class);
    private final CreateProjectUseCase createProjectUseCase = mock(CreateProjectUseCase.class);
    private final CreateStoryVersionUseCase createStoryVersionUseCase = mock(CreateStoryVersionUseCase.class);
    private ProjectController controller;

    @BeforeEach
    void setUp() {
        controller = new ProjectController(
            listProjectsUseCase,
            createProjectUseCase,
            createStoryVersionUseCase);
    }

    @Test
    void listMapsCursorInputToQueryAndPreservesEnvelope() {
        ProjectResponse project = new ProjectResponse(
            7L, "Story", "DRAFT", "vi-VN", "vi-VN", "vi-VN", "16:9", "STANDARD", 3L);
        CursorPage<ProjectResponse> page = new CursorPage<>(List.of(project), "next", 100, true);
        when(listProjectsUseCase.execute(any(ProjectListQuery.class)))
            .thenReturn(ApiResponse.success("Projects retrieved successfully", page));

        var responseEntity = controller.list("owner", "cursor-token", 100);

        assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
        assertTrue(responseEntity.getBody().success());
        verify(listProjectsUseCase).execute(new ProjectListQuery("owner", "cursor-token", 100));
    }

    @Test
    void createMapsRequestToCommandAndKeeps201() {
        ProjectResponse project = new ProjectResponse(
            7L, "Story", "DRAFT", "vi-VN", "vi-VN", "vi-VN", "16:9", "STANDARD", 0L);
        when(createProjectUseCase.execute(any(CreateProjectCommand.class)))
            .thenReturn(ApiResponse.success("Project created successfully", project));

        var responseEntity = controller.create(
            new CreateProjectRequest("Story", null, null, null, null, null),
            "owner");

        assertEquals(HttpStatus.CREATED, responseEntity.getStatusCode());
        assertEquals(7L, responseEntity.getBody().data().id());
    }
}
