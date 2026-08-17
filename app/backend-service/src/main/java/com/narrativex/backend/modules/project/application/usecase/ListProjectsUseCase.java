package com.narrativex.backend.modules.project.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;
import com.narrativex.backend.modules.project.application.query.ProjectListQuery;
import com.narrativex.backend.modules.project.application.response.ProjectResponse;
import com.narrativex.backend.shared.application.response.ApiResponse;
import com.narrativex.backend.shared.application.response.PaginationResponse;
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
    public ApiResponse<PaginationResponse<ProjectResponse>> execute(ProjectListQuery query) {
        var projects = projectRepository.findActiveByOwnerId(currentUserId.resolve(query.ownerId()), query.pageable());
        return ApiResponse.success("Projects retrieved successfully", PaginationResponse.from(projects, ProjectResponse::from));
    }
}
