package com.narrativex.backend.feature.project.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.usecase.DeleteProjectUseCase;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DeleteProjectUseCaseTest {
  @Mock private ProjectRepository projectRepository;

  @Test
  void archivesOwnedProjectUnderRowLock() {
    UUID projectId = UuidV7.random();
    Project project = project(projectId);
    when(projectRepository.findOwnedByIdForUpdate(projectId, "owner"))
        .thenReturn(Optional.of(project));
    when(projectRepository.save(project)).thenReturn(project);
    DeleteProjectUseCase useCase = new DeleteProjectUseCase(projectRepository, () -> "owner");

    useCase.execute(projectId);

    assertTrue(project.getStatus() == ProjectStatus.ARCHIVED);
    assertTrue(project.getArchivedAt() != null);
    verify(projectRepository).save(project);
  }

  @Test
  void hidesProjectsOutsideCurrentOwnerScope() {
    UUID projectId = UuidV7.random();
    when(projectRepository.findOwnedByIdForUpdate(projectId, "owner"))
        .thenReturn(Optional.empty());
    CurrentUserId currentUserId = () -> "owner";
    DeleteProjectUseCase useCase = new DeleteProjectUseCase(projectRepository, currentUserId);

    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(projectId));

    verify(projectRepository, never()).save(org.mockito.ArgumentMatchers.any());
  }

  private static Project project(UUID id) {
    return Project.rehydrate(
        id,
        0L,
        "Project",
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
