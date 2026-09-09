package com.narrativex.backend.feature.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.application.usecase.DeleteProjectCharacterUseCase;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DeleteProjectCharacterUseCaseTest {
  @Mock private ProjectCharacterRepository projectCharacterRepository;
  @Mock private ProjectAccess projectAccess;

  @Test
  void removesCharacterFromCurrentProject() {
    UUID projectId = UUID.randomUUID();
    UUID characterId = UUID.randomUUID();
    ProjectCharacter assignment = activeAssignment(projectId, characterId);
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.of(assignment));

    newUseCase().execute(projectId, characterId);

    assertEquals(ProjectCharacterStatus.REMOVED, assignment.getStatus());
    verify(projectAccess).findOwnedProject(projectId, "owner");
    verify(projectCharacterRepository).save(assignment);
  }

  @Test
  void rejectsCharacterThatIsNotAssignedToProject() {
    UUID projectId = UUID.randomUUID();
    UUID characterId = UUID.randomUUID();
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.empty());

    assertThrows(
        ResourceNotFoundException.class, () -> newUseCase().execute(projectId, characterId));
  }

  private DeleteProjectCharacterUseCase newUseCase() {
    CurrentUserId currentUserId = () -> "owner";
    return new DeleteProjectCharacterUseCase(
        projectCharacterRepository, projectAccess, currentUserId);
  }

  private static ProjectCharacter activeAssignment(UUID projectId, UUID characterId) {
    return ProjectCharacter.rehydrate(
        UUID.randomUUID(),
        0L,
        projectId,
        characterId,
        "SECONDARY",
        0,
        List.of(),
        null,
        List.of(),
        null,
        ProjectCharacterStatus.ACTIVE);
  }
}
