package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.query.ProjectListQuery;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListProjectsUseCase {
  private final ProjectRepository projectRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public CursorPage<Project> execute(ProjectListQuery query) {
    return projectRepository.findActiveByOwnerId(currentUserId.get(), query.cursor(), query.limit());
  }
}
