package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.Optional;

public interface ProjectRepository {
  CursorPage<Project> findActiveByOwnerId(String ownerId, String cursor, int limit);

  Optional<Project> findOwnedById(Long projectId, String ownerId);

  Optional<Project> findOwnedByIdForUpdate(Long projectId, String ownerId);

  Project save(Project project);
}
