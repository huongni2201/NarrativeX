package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import java.util.Optional;

public interface StoryVersionRepository {
  int findMaxVersionNumberByProjectId(Long projectId);

  Optional<StoryVersion> findByIdAndProjectId(Long storyVersionId, Long projectId);

  Optional<StoryVersion> findActiveByProjectId(Long projectId);

  StoryVersion save(StoryVersion storyVersion);

  StoryVersion saveAndFlush(StoryVersion storyVersion);
}
