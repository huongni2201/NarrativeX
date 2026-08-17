package com.narrativex.backend.feature.project.infrastructure.persistence.mapper;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.ProjectJpaEntity;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;

public final class ProjectPersistenceMapper {
    private ProjectPersistenceMapper() {}
    public static Project toDomain(ProjectJpaEntity entity) {
        return Project.rehydrate(entity.getId(), entity.getRowVersion(), entity.getName(), entity.getOwnerId(),
            entity.getStatus(), entity.getSourceLanguage(), entity.getNarrationLanguage(), entity.getMetadataLanguage(),
            entity.getImageAspectRatio(), entity.getImageQualityTier(), entity.getArchivedAt());
    }
    public static StoryVersion toDomain(StoryVersionJpaEntity entity) {
        return StoryVersion.rehydrate(entity.getId(), entity.getRowVersion(), entity.getProjectId(), entity.getVersionNumber(),
            entity.getContent(), entity.getSourceLanguage(), entity.getStatus(), entity.getModerationDecision(),
            entity.isRightsAttested(), entity.getRightsPolicyVersion(), entity.getRightsBasis(), entity.getRightsAttestedAt(), entity.getRightsAttestedBy());
    }
}
