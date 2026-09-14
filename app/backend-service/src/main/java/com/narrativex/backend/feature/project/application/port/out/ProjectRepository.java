package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository {
  CursorPage<Project> findActive(String cursor, int limit);

  Optional<Project> findById(UUID projectId);

  Optional<Project> findByIdForUpdate(UUID projectId);

  Project save(Project project);
}
