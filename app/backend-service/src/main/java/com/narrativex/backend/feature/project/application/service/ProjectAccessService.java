package com.narrativex.backend.feature.project.application.service;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Internal cross-module access service; this is not an HTTP-facing query use case. */
@Service
@RequiredArgsConstructor
public class ProjectAccessService implements ProjectAccess, StoryVersionAccess {
  private final ProjectRepository projectRepository;
  private final StoryVersionRepository storyVersionRepository;

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

  @Override
  @Transactional(readOnly = true)
  public void requireOwnedStoryVersion(Long projectId, Long storyVersionId, String ownerId) {
    findOwnedProject(projectId, ownerId);
    storyVersionRepository
        .findByIdAndProjectId(storyVersionId, projectId)
        .orElseThrow(() -> new ResourceNotFoundException("Story version not found"));
  }
}
