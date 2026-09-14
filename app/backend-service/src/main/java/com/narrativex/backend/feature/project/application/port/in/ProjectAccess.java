package com.narrativex.backend.feature.project.application.port.in;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.UUID;

/** Cross-module inbound contract for project access. */
public interface ProjectAccess {
  Project findProject(UUID projectId);

  Project findProjectForUpdate(UUID projectId);
}
