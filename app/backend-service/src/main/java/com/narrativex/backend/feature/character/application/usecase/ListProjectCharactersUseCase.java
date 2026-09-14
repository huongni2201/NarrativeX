package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterReadRepository;
import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListProjectCharactersUseCase {
  private final ProjectCharacterReadRepository repository;

  @Transactional(readOnly = true)
  public CursorPage<ProjectCharacterReadModel> execute(UUID projectId, String cursor, int limit) {
    if (!repository.projectExists(projectId)) {
      throw new ResourceNotFoundException("Project not found");
    }
    return repository.findByProject(projectId, cursor, limit);
  }
}
