package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ProjectOverviewQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetProjectOverviewUseCase {
  private final ProjectAccess projectAccess;
  private final ProjectOverviewQueryRepository projectOverviewQueryRepository;

  @Transactional(readOnly = true)
  public ProjectOverviewView execute(UUID projectId) {
    projectAccess.findProject(projectId);
    return projectOverviewQueryRepository.get(projectId);
  }
}
