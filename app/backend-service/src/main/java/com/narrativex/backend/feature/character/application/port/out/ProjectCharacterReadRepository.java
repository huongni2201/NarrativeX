package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.Optional;
import java.util.UUID;

public interface ProjectCharacterReadRepository {
  boolean projectExists(UUID projectId);

  CursorPage<ProjectCharacterReadModel> findByProject(
      UUID projectId, String cursor, int limit);

  Optional<ProjectCharacterReadModel> findDetail(UUID projectId, UUID characterId);
}
