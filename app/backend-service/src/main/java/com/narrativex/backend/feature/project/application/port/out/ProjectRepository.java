package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository {
  CursorPage<Project> findActiveByOwnerId(String ownerId, String cursor, int limit);

  Optional<Project> findOwnedById(UUID projectId, String ownerId);

  Optional<Project> findOwnedByIdForUpdate(UUID projectId, String ownerId);

  Project save(Project project);
}
