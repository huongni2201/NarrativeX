package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import java.util.Optional;
import java.util.UUID;

public interface StoryVersionRepository {
  int findMaxVersionNumberByProjectId(UUID projectId);

  Optional<StoryVersion> findByIdAndProjectId(UUID storyVersionId, UUID projectId);

  Optional<StoryVersion> findActiveByProjectId(UUID projectId);

  Optional<StoryVersion> findLatestByProjectId(UUID projectId);

  StoryVersion save(StoryVersion storyVersion);

  StoryVersion saveAndFlush(StoryVersion storyVersion);
}
