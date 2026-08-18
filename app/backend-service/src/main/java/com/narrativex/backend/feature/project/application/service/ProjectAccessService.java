package com.narrativex.backend.feature.project.application.service;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Internal cross-module access service; this is not an HTTP-facing query use case. */
@Service
public class ProjectAccessService implements ProjectAccess {
  private final ProjectRepository projectRepository;

  public ProjectAccessService(ProjectRepository projectRepository) {
    this.projectRepository = projectRepository;
  }

  @Override
  @Transactional(readOnly = true)
  public Project findOwnedProject(Long projectId, String ownerId) {
    return projectRepository
        .findOwnedById(projectId, ownerId)
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }

  @Override
  @Transactional
  public Project findOwnedProjectForUpdate(Long projectId, String ownerId) {
    return projectRepository
        .findOwnedByIdForUpdate(projectId, ownerId)
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }
}
