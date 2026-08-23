package com.narrativex.backend.feature.project.application.service;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.application.usecase.CreateStoryVersionUseCase;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Ownership-checked cross-feature StoryVersion scope validation. */
@Service
@RequiredArgsConstructor
public class StoryVersionAccessService implements StoryVersionAccess {
  private final ProjectAccess projectAccess;
  private final StoryVersionRepository storyVersionRepository;
  private final CreateStoryVersionUseCase createStoryVersionUseCase;

  @Override
  @Transactional(readOnly = true)
  public void requireOwnedStoryVersion(UUID projectId, UUID storyVersionId, String ownerId) {
    projectAccess.findOwnedProject(projectId, ownerId);
    storyVersionRepository
        .findByIdAndProjectId(storyVersionId, projectId)
        .orElseThrow(() -> new ResourceNotFoundException("Story version not found"));
  }

  @Override
  @Transactional
  public UUID resolveOrCreateStoryVersion(UUID projectId, String ownerId, String fallbackContent) {
    Project project = projectAccess.findOwnedProjectForUpdate(projectId, ownerId);
    return storyVersionRepository
        .findActiveByProjectId(projectId)
        .or(() -> storyVersionRepository.findLatestByProjectId(projectId))
        .map(version -> version.getId())
        .orElseGet(
            () ->
                createStoryVersionUseCase
                    .execute(
                        new CreateStoryVersionCommand(
                            projectId, fallbackContent, project.getSourceLanguage(), null))
                    .getId());
  }
}
