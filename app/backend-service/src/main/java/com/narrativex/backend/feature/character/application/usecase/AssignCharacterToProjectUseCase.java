package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.AssignCharacterToProjectCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
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
    ProjectCharacter assignment =
        ProjectCharacter.assign(
            command.projectId(),
            command.characterId(),
            command.role(),
            command.importance(),
            command.projectAliases(),
            command.storyMetadata(),
            command.groups(),
            null);
    if (command.pinnedCharacterVersionId() != null) {
      assignment.pinVersion(
          versionRepository
              .findOwnedById(command.pinnedCharacterVersionId(), ownerId)
              .orElseThrow(() -> new ResourceNotFoundException("Character version not found")));
    }
    ProjectCharacter saved = projectCharacterRepository.save(assignment);
    log.info(
        "Assigned characterId={} to projectId={} with role='{}', pinnedVersionId={}",
        command.characterId(),
        command.projectId(),
        command.role(),
        command.pinnedCharacterVersionId());
    return saved;
  }
}
