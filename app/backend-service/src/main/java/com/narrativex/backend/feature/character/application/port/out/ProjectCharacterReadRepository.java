package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.Optional;

public interface ProjectCharacterReadRepository {
  boolean projectOwnedBy(Long projectId, String ownerId);

  CursorPage<ProjectCharacterReadModel> findByProject(
      Long projectId, String ownerId, String cursor, int limit);

  Optional<ProjectCharacterReadModel> findDetail(Long projectId, Long characterId, String ownerId);
}
