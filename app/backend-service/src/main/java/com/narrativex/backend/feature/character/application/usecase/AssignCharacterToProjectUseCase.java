package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.AssignCharacterToProjectCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssignCharacterToProjectUseCase {
  private final CharacterRepository characterRepository;
  private final CharacterVersionRepository versionRepository;
  private final ProjectCharacterRepository projectCharacterRepository;
  private final ProjectAccess projectAccess;
  private final CurrentUserId currentUserId;

  @Transactional
  public ProjectCharacter execute(AssignCharacterToProjectCommand command) {
    String ownerId = currentUserId.get();
    projectAccess.findOwnedProject(command.projectId(), ownerId);
    characterRepository
        .findOwnedById(command.characterId(), ownerId)
        .orElseThrow(() -> new ResourceNotFoundException("Character not found"));

    Optional<ProjectCharacter> existingAssignment =
        projectCharacterRepository.findByProjectAndCharacterForUpdate(
            command.projectId(), command.characterId());
    if (existingAssignment.isPresent()
        && existingAssignment.get().getStatus() == ProjectCharacterStatus.ACTIVE) {
      ProjectCharacter existing = existingAssignment.get();
      if (!matchesAssignmentRequest(existing, command)) {
        throw new ResourceConflictException(
            "Character is already assigned to this project with different assignment metadata");
      }
      log.info(
          "CharacterId={} is already assigned to projectId={}; returning existing assignment id={}",
          command.characterId(),
          command.projectId(),
          existing.getId());
      return existing;
    }

    ProjectCharacter assignment;
    if (existingAssignment.isPresent()) {
      assignment = existingAssignment.get();
      assignment.reactivate(
          command.role(),
          command.importance(),
          command.projectAliases(),
          command.storyMetadata(),
          command.groups());
    } else {
      assignment =
          ProjectCharacter.assign(
              command.projectId(),
              command.characterId(),
              command.role(),
              command.importance(),
              command.projectAliases(),
              command.storyMetadata(),
              command.groups(),
              null);
    }

    if (command.pinnedCharacterVersionId() != null) {
      assignment.pinVersion(
          versionRepository
              .findOwnedById(command.pinnedCharacterVersionId(), ownerId)
              .orElseThrow(() -> new ResourceNotFoundException("Character version not found")));
    }
    ProjectCharacter saved = projectCharacterRepository.save(assignment);
    if (saved.getStatus() != ProjectCharacterStatus.ACTIVE
        || !matchesAssignmentRequest(saved, command)) {
      throw new ResourceConflictException(
          "Character assignment changed concurrently with different assignment metadata");
    }
    log.info(
        "Assigned characterId={} to projectId={} with role='{}', pinnedVersionId={}",
        command.characterId(),
        command.projectId(),
        command.role(),
        command.pinnedCharacterVersionId());
    return saved;
  }

  private static boolean matchesAssignmentRequest(
      ProjectCharacter existing, AssignCharacterToProjectCommand command) {
    return Objects.equals(existing.getRole(), command.role())
        && existing.getImportance() == command.importance()
        && existing.getProjectAliases().equals(emptyIfNull(command.projectAliases()))
        && Objects.equals(existing.getStoryMetadata(), command.storyMetadata())
        && existing.getGroups().equals(emptyIfNull(command.groups()))
        && Objects.equals(
            existing.getPinnedCharacterVersionId(), command.pinnedCharacterVersionId());
  }

  private static <T> List<T> emptyIfNull(List<T> values) {
    return values == null ? List.of() : values;
  }
}
