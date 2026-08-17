package com.narrativex.backend.modules.character.infrastructure.persistence;

import com.narrativex.backend.modules.character.domain.model.Character;
import com.narrativex.backend.modules.character.domain.model.CharacterAppearance;
import com.narrativex.backend.modules.character.domain.model.CharacterVersion;
import com.narrativex.backend.modules.character.domain.model.OutfitVersion;
import com.narrativex.backend.modules.character.domain.model.ProjectCharacter;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterAppearanceJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterVersionJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.ProjectCharacterJpaEntity;

public final class CharacterPersistenceMapper {
    private CharacterPersistenceMapper() {
    }

    public static Character toDomain(CharacterJpaEntity entity) {
        return Character.rehydrate(entity.getId(), entity.getRowVersion(), entity.getOwnerId(),
            entity.getWorkspaceId(), entity.getCanonicalName(), entity.getAliases(), entity.getStatus());
    }

    public static CharacterVersion toDomain(CharacterVersionJpaEntity entity) {
        return CharacterVersion.rehydrate(entity.getId(), entity.getRowVersion(), entity.getCharacterId(),
            entity.getVersionNumber(), entity.getBible(), entity.getVisualPrompt(), entity.getMasterAssetId(),
            entity.getReferenceAssetIds(), entity.getStatus(), entity.getLockedAt(), entity.getLockedBy());
    }

    public static ProjectCharacter toDomain(ProjectCharacterJpaEntity entity) {
        return ProjectCharacter.rehydrate(entity.getId(), entity.getRowVersion(), entity.getProjectId(),
            entity.getCharacterId(), entity.getRole(), entity.getImportance(), entity.getProjectAliases(),
            entity.getStoryMetadata(), entity.getGroups(), entity.getPinnedCharacterVersionId(), entity.getStatus());
    }

    public static CharacterAppearance toDomain(CharacterAppearanceJpaEntity entity) {
        return CharacterAppearance.rehydrate(entity.getId(), entity.getRowVersion(), entity.getCharacterId(),
            entity.getProjectId(), entity.getTimelineKey(), entity.getAgeState(), entity.getHairstyle(),
            entity.getInjury(), entity.getWardrobeContext(), entity.getAppearancePrompt(), entity.getOutfitVersionId());
    }

    public static OutfitVersion toDomain(OutfitVersionJpaEntity entity) {
        return OutfitVersion.rehydrate(entity.getId(), entity.getRowVersion(), entity.getCharacterId(),
            entity.getVersionNumber(), entity.getName(), entity.getDescription(), entity.getPrompt(), entity.getStatus());
    }
}
