package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterReadRepository;
import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetProjectCharacterDetailUseCase {
  private final ProjectCharacterReadRepository repository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public ProjectCharacterReadModel execute(Long projectId, Long characterId) {
    String ownerId = currentUserId.get();
    if (!repository.projectOwnedBy(projectId, ownerId)) {
      throw new ResourceNotFoundException("Project not found");
    }
    return repository
        .findDetail(projectId, characterId, ownerId)
        .orElseThrow(() -> new ResourceNotFoundException("Project character not found"));
  }
}
