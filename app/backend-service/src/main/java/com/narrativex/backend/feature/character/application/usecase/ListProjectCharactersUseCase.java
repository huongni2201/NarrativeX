package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
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
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public CursorPage<ProjectCharacterReadModel> execute(UUID projectId, String cursor, int limit) {
    String ownerId = currentUserId.get();
    if (!repository.projectOwnedBy(projectId, ownerId)) {
      throw new ResourceNotFoundException("Project not found");
    }
    return repository.findByProject(projectId, ownerId, cursor, limit);
  }
}
