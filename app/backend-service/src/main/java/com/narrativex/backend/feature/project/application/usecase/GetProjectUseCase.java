package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.api.response.ProjectResponse;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.query.GetProjectQuery;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetProjectUseCase {
  private final ProjectRepository projectRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public ApiResponse<ProjectResponse> execute(GetProjectQuery query) {
    var project =
        projectRepository
            .findOwnedById(query.projectId(), currentUserId.get())
            .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    log.debug("Loaded project {}", query.projectId());
    return ApiResponse.success("Project retrieved successfully", ProjectResponse.from(project));
  }
}
