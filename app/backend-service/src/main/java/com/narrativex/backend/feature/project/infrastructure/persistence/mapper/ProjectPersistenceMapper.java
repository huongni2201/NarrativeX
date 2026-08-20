package com.narrativex.backend.feature.project.infrastructure.persistence.mapper;

import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;

public final class ProjectPersistenceMapper {
  private ProjectPersistenceMapper() {}

  public static StoryVersion toDomain(StoryVersionJpaEntity entity) {
    return StoryVersion.rehydrate(
        entity.getId(),
        entity.getRowVersion(),
        entity.getProjectId(),
        entity.getVersionNumber(),
        entity.getContent(),
        entity.getSourceLanguage(),
        entity.getStatus(),
        entity.getModerationDecision());
  }
}
