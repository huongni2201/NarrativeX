package com.narrativex.backend.feature.project.application.port.in;

import com.narrativex.backend.feature.project.domain.aggregate.Project;

/** Cross-module inbound contract for ownership-checked project access. */
public interface ProjectAccess {
    Project findOwnedProject(Long projectId, String ownerId);
    Project findOwnedProjectForUpdate(Long projectId, String ownerId);
}
