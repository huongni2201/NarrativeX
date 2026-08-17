package com.narrativex.backend.modules.project.application;

import com.narrativex.backend.modules.project.domain.Project;

public interface ProjectAccess {

    Project findOwnedProject(Long projectId, String ownerId);
}
