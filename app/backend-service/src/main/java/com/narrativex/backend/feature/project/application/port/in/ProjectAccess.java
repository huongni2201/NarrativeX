package com.narrativex.backend.feature.project.application.port.in;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import java.util.UUID;

/** Cross-module inbound contract for project access. */
public interface ProjectAccess {
  Project findProject(UUID projectId);

  Project findProjectForUpdate(UUID projectId);

  default void requireEditableProjectForUpdate(UUID projectId) {
    if (findProjectForUpdate(projectId).getStatus() == ProjectStatus.ARCHIVED) {
      throw new IllegalArgumentException("Cannot change an archived project");
    }
  }
}
