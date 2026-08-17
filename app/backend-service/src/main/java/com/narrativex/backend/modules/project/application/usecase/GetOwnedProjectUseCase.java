package com.narrativex.backend.modules.project.application.usecase;

import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GetOwnedProjectUseCase implements ProjectAccess {

    private final ProjectRepository projectRepository;
    private final CurrentUserId currentUserId;

    public GetOwnedProjectUseCase(ProjectRepository projectRepository, CurrentUserId currentUserId) {
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
