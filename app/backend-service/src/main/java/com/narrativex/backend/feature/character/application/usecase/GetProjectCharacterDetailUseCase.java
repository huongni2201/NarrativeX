package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterReadRepository;
import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetProjectCharacterDetailUseCase {
  private final ProjectCharacterReadRepository repository;

  @Transactional(readOnly = true)
  public ProjectCharacterReadModel execute(UUID projectId, UUID characterId) {
    if (!repository.projectExists(projectId)) {
      throw new ResourceNotFoundException("Project not found");
    }
    return repository
        .findDetail(projectId, characterId)
        .orElseThrow(() -> new ResourceNotFoundException("Project character not found"));
  }
}
