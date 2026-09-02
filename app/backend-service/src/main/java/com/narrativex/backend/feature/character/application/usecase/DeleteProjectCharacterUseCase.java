package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeleteProjectCharacterUseCase {
  private final ProjectCharacterRepository projectCharacterRepository;
  private final ProjectAccess projectAccess;
  private final CurrentUserId currentUserId;

  @Transactional
  public void execute(UUID projectId, UUID characterId) {
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    var assignment =
        projectCharacterRepository
            .findByProjectAndCharacterForUpdate(projectId, characterId)
            .orElseThrow(() -> new ResourceNotFoundException("Project character not found"));
    assignment.remove();
    projectCharacterRepository.save(assignment);
  }
}
