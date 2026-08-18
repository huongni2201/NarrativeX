package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.response.ProjectResponse;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.query.ProjectListQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListProjectsUseCase {
  private final ProjectRepository projectRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public ApiResponse<CursorPage<ProjectResponse>> execute(ProjectListQuery query) {
    String ownerId = currentUserId.get();
    CursorPage<ProjectResponse> page =
        projectRepository
            .findActiveByOwnerId(ownerId, query.cursor(), query.limit())
            .map(ProjectResponse::from);
    return ApiResponse.success("Projects retrieved successfully", page);
  }
}
