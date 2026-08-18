package com.narrativex.backend.feature.project.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.api.controller.ProjectController;
import com.narrativex.backend.feature.project.api.request.CreateProjectRequest;
import com.narrativex.backend.feature.project.application.command.CreateProjectCommand;
import com.narrativex.backend.feature.project.application.query.ProjectListQuery;
import com.narrativex.backend.feature.project.application.usecase.CreateProjectUseCase;
import com.narrativex.backend.feature.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.feature.project.application.usecase.GetProjectUseCase;
import com.narrativex.backend.feature.project.application.usecase.ListProjectsUseCase;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ProjectControllerContractTest {
  private final ListProjectsUseCase listProjectsUseCase = mock(ListProjectsUseCase.class);
  private final GetProjectUseCase getProjectUseCase = mock(GetProjectUseCase.class);
  private final CreateProjectUseCase createProjectUseCase = mock(CreateProjectUseCase.class);
  private final CreateStoryVersionUseCase createStoryVersionUseCase =
      mock(CreateStoryVersionUseCase.class);
  private ProjectController controller;

  @BeforeEach
  void setUp() {
    controller =
        new ProjectController(
            listProjectsUseCase,
            getProjectUseCase,
            createProjectUseCase,
            createStoryVersionUseCase);
  }

  @Test
  void listMapsCursorInputToQueryAndPreservesEnvelope() {
    CursorPage<Project> page = new CursorPage<>(List.of(project(7L, 3L)), "next", 100, true);
    when(listProjectsUseCase.execute(any(ProjectListQuery.class))).thenReturn(page);

    var responseEntity = controller.list("cursor-token", 100);

    assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
    assertTrue(responseEntity.getBody().success());
    assertEquals(7L, responseEntity.getBody().data().content().getFirst().id());
    verify(listProjectsUseCase).execute(new ProjectListQuery(null, "cursor-token", 100));
  }

  @Test
  void createMapsRequestToCommandAndKeeps201() {
    when(createProjectUseCase.execute(any(CreateProjectCommand.class))).thenReturn(project(7L, 0L));

    var responseEntity =
        controller.create(new CreateProjectRequest("Story", null, null, null, null, null));

    assertEquals(HttpStatus.CREATED, responseEntity.getStatusCode());
    assertEquals(7L, responseEntity.getBody().data().id());
  }

  private static Project project(Long id, long rowVersion) {
    return Project.rehydrate(
        id,
        rowVersion,
        "Story",
        "owner",
        ProjectStatus.DRAFT,
        "vi-VN",
        "vi-VN",
        "vi-VN",
        AspectRatio.RATIO_16_9,
        ImageQualityTier.STANDARD,
        null);
  }
}
