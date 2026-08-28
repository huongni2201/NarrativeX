package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PinCharacterVersionUseCase {
  private final ProjectCharacterRepository projectCharacterRepository;
  private final CharacterVersionRepository versionRepository;
  private final ProjectAccess projectAccess;
  private final CurrentUserId currentUserId;

  @Transactional
  public ProjectCharacter execute(UUID projectId, UUID characterId, UUID versionId) {
    String ownerId = currentUserId.get();
    projectAccess.findOwnedProject(projectId, ownerId);
    ProjectCharacter assignment =
        projectCharacterRepository
            .findByProjectAndCharacterForUpdate(projectId, characterId)
            .orElseThrow(() -> new ResourceNotFoundException("Project character not found"));
    var version =
        versionRepository
            .findOwnedById(versionId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
    assignment.pinVersion(version);
    return projectCharacterRepository.save(assignment);
  }
}
