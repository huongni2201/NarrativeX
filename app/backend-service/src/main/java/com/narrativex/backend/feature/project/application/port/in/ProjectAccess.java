package com.narrativex.backend.feature.project.application.port.in;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.UUID;

/** Cross-module inbound contract for ownership-checked project access. */
public interface ProjectAccess {
  Project findOwnedProject(UUID projectId, String ownerId);

  Project findOwnedProjectForUpdate(UUID projectId, String ownerId);
}
