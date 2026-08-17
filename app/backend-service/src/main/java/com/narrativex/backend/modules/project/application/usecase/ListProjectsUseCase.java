package com.narrativex.backend.modules.project.application.usecase;

import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ListProjectsUseCase {

    private final ProjectRepository projectRepository;
    private final CurrentUserId currentUserId;

    public ListProjectsUseCase(ProjectRepository projectRepository, CurrentUserId currentUserId) {
        this.projectRepository = projectRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional(readOnly = true)
    public Page<Project> execute(String ownerId, Pageable pageable) {
        return projectRepository.findActiveByOwnerId(currentUserId.resolve(ownerId), pageable);
    }
}
