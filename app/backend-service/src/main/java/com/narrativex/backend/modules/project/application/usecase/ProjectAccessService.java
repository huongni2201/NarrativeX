package com.narrativex.backend.modules.project.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.domain.aggregate.Project;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Internal cross-module access service; this is not an HTTP-facing query use case. */
@Service
public class ProjectAccessService implements ProjectAccess {
    private final ProjectRepository projectRepository;
    private final CurrentUserId currentUserId;

    public ProjectAccessService(ProjectRepository projectRepository, CurrentUserId currentUserId) {
        this.projectRepository = projectRepository;
        this.currentUserId = currentUserId;
    }

    @Override
    @Transactional(readOnly = true)
    public Project findOwnedProject(Long projectId, String ownerId) {
        return projectRepository.findOwnedById(projectId, currentUserId.resolve(ownerId))
            .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    }

    @Override
    @Transactional
    public Project findOwnedProjectForUpdate(Long projectId, String ownerId) {
        return projectRepository.findOwnedByIdForUpdate(projectId, currentUserId.resolve(ownerId))
            .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    }
}
