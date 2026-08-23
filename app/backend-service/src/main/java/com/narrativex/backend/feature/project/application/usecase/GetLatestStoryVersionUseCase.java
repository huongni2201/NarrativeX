package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetLatestStoryVersionUseCase {
  private final ProjectAccess projectAccess;
  private final StoryVersionRepository storyVersionRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public StoryVersion execute(UUID projectId) {
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    return storyVersionRepository
        .findLatestByProjectId(projectId)
        .orElseThrow(() -> new ResourceNotFoundException("Story version not found"));
  }
}
