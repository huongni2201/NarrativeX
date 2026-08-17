package com.narrativex.backend.modules.project.application.usecase;

import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.shared.security.CurrentUserId;
import java.util.List;
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
    public List<Project> execute(String ownerId) {
        return projectRepository.findActiveByOwnerId(currentUserId.resolve(ownerId));
    }
}
