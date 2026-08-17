package com.narrativex.backend.modules.project.infrastructure.persistence;

import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.modules.project.domain.model.StoryVersion;
import com.narrativex.backend.modules.project.infrastructure.persistence.entity.ProjectJpaEntity;
import com.narrativex.backend.modules.project.infrastructure.persistence.entity.StoryVersionJpaEntity;

public final class ProjectPersistenceMapper {

    private ProjectPersistenceMapper() {
    }

    public static Project toDomain(ProjectJpaEntity entity) {
        return Project.rehydrate(entity.getId(), entity.getRowVersion(), entity.getName(), entity.getOwnerId(),
            entity.getStatus(), entity.getSourceLanguage(), entity.getNarrationLanguage(),
            entity.getMetadataLanguage(), entity.getImageAspectRatio(), entity.getImageQualityTier(),
            entity.getArchivedAt());
    }

    public static StoryVersion toDomain(StoryVersionJpaEntity entity) {
        return StoryVersion.rehydrate(entity.getId(), entity.getRowVersion(), entity.getProjectId(),
            entity.getVersionNumber(), entity.getContent(), entity.getSourceLanguage(), entity.getStatus(),
            entity.getModerationDecision(), entity.isRightsAttested(), entity.getRightsPolicyVersion(),
            entity.getRightsBasis(), entity.getRightsAttestedAt(), entity.getRightsAttestedBy());
    }
}
