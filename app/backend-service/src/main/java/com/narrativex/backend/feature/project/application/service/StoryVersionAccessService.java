package com.narrativex.backend.feature.project.application.service;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
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

  @Override
  @Transactional(readOnly = true)
  public void requireOwnedStoryVersion(UUID projectId, UUID storyVersionId, String ownerId) {
    projectAccess.findOwnedProject(projectId, ownerId);
    storyVersionRepository
        .findByIdAndProjectId(storyVersionId, projectId)
        .orElseThrow(() -> new ResourceNotFoundException("Story version not found"));
  }
}
