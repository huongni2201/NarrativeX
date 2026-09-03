package com.narrativex.backend.feature.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.AssignCharacterToProjectCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.application.usecase.AssignCharacterToProjectUseCase;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssignCharacterToProjectUseCaseTest {
  @Mock private CharacterRepository characterRepository;
  @Mock private CharacterVersionRepository versionRepository;
  @Mock private ProjectCharacterRepository projectCharacterRepository;
  @Mock private ProjectAccess projectAccess;

  @Test
  void assignmentUsesProjectAccessAndPersistsAnAssociation() {
    UUID characterId = UUID.randomUUID();
    UUID projectId = UUID.randomUUID();
    stubOwnedProjectAndCharacter(projectId, characterId);
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.empty());
    when(projectCharacterRepository.save(any(ProjectCharacter.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    ProjectCharacter response =
        newUseCase().execute(command(projectId, characterId, "PROTAGONIST", 1));

    assertEquals(characterId, response.getCharacterId());
    assertEquals(projectId, response.getProjectId());
    verify(projectAccess).findOwnedProject(projectId, "owner");
    verify(projectCharacterRepository).save(any(ProjectCharacter.class));
  }

  @Test
  void exactReplayOfActiveAssignmentIsIdempotent() {
    UUID characterId = UUID.randomUUID();
    UUID projectId = UUID.randomUUID();
    ProjectCharacter existing =
        ProjectCharacter.rehydrate(
            UUID.randomUUID(),
            4L,
            projectId,
            characterId,
            "MAIN",
            8,
            List.of(),
            null,
            List.of(),
            null,
            ProjectCharacterStatus.ACTIVE);
    stubOwnedProjectAndCharacter(projectId, characterId);
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.of(existing));

    ProjectCharacter response = newUseCase().execute(command(projectId, characterId, "MAIN", 8));

    assertSame(existing, response);
    verify(projectCharacterRepository, never()).save(any(ProjectCharacter.class));
  }

  @Test
  void activeAssignmentWithDifferentPayloadIsRejected() {
    UUID characterId = UUID.randomUUID();
    UUID projectId = UUID.randomUUID();
    ProjectCharacter existing =
        ProjectCharacter.rehydrate(
            UUID.randomUUID(),
            4L,
            projectId,
            characterId,
            "MAIN",
            8,
            List.of("Lead"),
            "existing",
            List.of("heroes"),
            null,
            ProjectCharacterStatus.ACTIVE);
    stubOwnedProjectAndCharacter(projectId, characterId);
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.of(existing));

    AssignCharacterToProjectCommand conflicting =
        new AssignCharacterToProjectCommand(
            projectId,
            characterId,
            "SUPPORTING",
            1,
            List.of("Different alias"),
            "different metadata",
            List.of("supporting-cast"),
            null);

    assertThrows(ResourceConflictException.class, () -> newUseCase().execute(conflicting));
    verify(projectCharacterRepository, never()).save(any(ProjectCharacter.class));
  }

  @Test
  void concurrentExactInsertReplayReturnsTheWinningAssignment() {
    UUID characterId = UUID.randomUUID();
    UUID projectId = UUID.randomUUID();
    ProjectCharacter winner =
        ProjectCharacter.rehydrate(
            UUID.randomUUID(),
            0L,
            projectId,
            characterId,
            "MAIN",
            8,
            List.of(),
            null,
            List.of(),
            null,
            ProjectCharacterStatus.ACTIVE);
    stubOwnedProjectAndCharacter(projectId, characterId);
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.empty());
    when(projectCharacterRepository.save(any(ProjectCharacter.class))).thenReturn(winner);

    ProjectCharacter response = newUseCase().execute(command(projectId, characterId, "MAIN", 8));

    assertSame(winner, response);
  }

  @Test
  void concurrentInsertWithDifferentWinningPayloadIsRejected() {
    UUID characterId = UUID.randomUUID();
    UUID projectId = UUID.randomUUID();
    ProjectCharacter winner =
        ProjectCharacter.rehydrate(
            UUID.randomUUID(),
            0L,
            projectId,
            characterId,
            "MAIN",
            8,
            List.of(),
            null,
            List.of(),
            null,
            ProjectCharacterStatus.ACTIVE);
    stubOwnedProjectAndCharacter(projectId, characterId);
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.empty());
    when(projectCharacterRepository.save(any(ProjectCharacter.class))).thenReturn(winner);

    assertThrows(
        ResourceConflictException.class,
        () -> newUseCase().execute(command(projectId, characterId, "SUPPORTING", 1)));
  }

  @Test
  void assigningARemovedCharacterReactivatesTheExistingAssociation() {
    UUID characterId = UUID.randomUUID();
    UUID projectId = UUID.randomUUID();
    UUID assignmentId = UUID.randomUUID();
    ProjectCharacter existing =
        ProjectCharacter.rehydrate(
            assignmentId,
            7L,
            projectId,
            characterId,
            "SUPPORTING",
            1,
            List.of("Old alias"),
            "old metadata",
            List.of("old-group"),
            UUID.randomUUID(),
            ProjectCharacterStatus.REMOVED);
    stubOwnedProjectAndCharacter(projectId, characterId);
    when(projectCharacterRepository.findByProjectAndCharacterForUpdate(projectId, characterId))
        .thenReturn(Optional.of(existing));
    when(projectCharacterRepository.save(any(ProjectCharacter.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    AssignCharacterToProjectCommand command =
        new AssignCharacterToProjectCommand(
            projectId,
            characterId,
            "ANTAGONIST",
            5,
            List.of("New alias"),
            "new metadata",
            List.of("villains"),
            null);

    ProjectCharacter response = newUseCase().execute(command);

    assertSame(existing, response);
    assertEquals(assignmentId, response.getId());
    assertEquals(ProjectCharacterStatus.ACTIVE, response.getStatus());
    assertEquals("ANTAGONIST", response.getRole());
    assertEquals(5, response.getImportance());
    assertEquals(List.of("New alias"), response.getProjectAliases());
    assertEquals("new metadata", response.getStoryMetadata());
    assertEquals(List.of("villains"), response.getGroups());
    assertNull(response.getPinnedCharacterVersionId());
    verify(projectCharacterRepository).save(same(existing));
  }

  private AssignCharacterToProjectUseCase newUseCase() {
    CurrentUserId currentUserId = () -> "owner";
    return new AssignCharacterToProjectUseCase(
        characterRepository,
        versionRepository,
        projectCharacterRepository,
        projectAccess,
        currentUserId);
  }

  private void stubOwnedProjectAndCharacter(UUID projectId, UUID characterId) {
    Character character =
        Character.rehydrate(
            characterId, 0L, "owner", null, "Mina", List.of(), CharacterStatus.ACTIVE);
    Project project =
        Project.rehydrate(
            projectId,
            0L,
            "Story",
            "owner",
            ProjectStatus.DRAFT,
            "vi-VN",
            "vi-VN",
            "vi-VN",
            AspectRatio.RATIO_16_9,
            null);
    when(projectAccess.findOwnedProject(projectId, "owner")).thenReturn(project);
    when(characterRepository.findOwnedById(characterId, "owner"))
        .thenReturn(Optional.of(character));
  }

  private static AssignCharacterToProjectCommand command(
      UUID projectId, UUID characterId, String role, int importance) {
    return new AssignCharacterToProjectCommand(
        projectId, characterId, role, importance, List.of(), null, List.of(), null);
  }
}
