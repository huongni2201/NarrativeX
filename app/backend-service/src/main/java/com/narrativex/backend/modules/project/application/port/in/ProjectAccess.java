package com.narrativex.backend.modules.project.application.port.in;

import com.narrativex.backend.modules.project.domain.aggregate.Project;

/** Cross-module inbound contract for ownership-checked project access. */
public interface ProjectAccess {
    Project findOwnedProject(Long projectId, String ownerId);
    Project findOwnedProjectForUpdate(Long projectId, String ownerId);
}
