package com.narrativex.backend.modules.character.infrastructure.persistence.mapper;

import com.narrativex.backend.modules.character.domain.aggregate.Character;
import com.narrativex.backend.modules.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.modules.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.modules.character.domain.entity.CharacterVersion;
import com.narrativex.backend.modules.character.domain.entity.OutfitVersion;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterAppearanceJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterVersionJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import com.narrativex.backend.modules.character.infrastructure.persistence.entity.ProjectCharacterJpaEntity;

public final class CharacterPersistenceMapper {
    private CharacterPersistenceMapper() {}
    public static Character toDomain(CharacterJpaEntity e) { return Character.rehydrate(e.getId(), e.getRowVersion(), e.getOwnerId(), e.getWorkspaceId(), e.getCanonicalName(), e.getAliases(), e.getStatus()); }
    public static CharacterVersion toDomain(CharacterVersionJpaEntity e) { return CharacterVersion.rehydrate(e.getId(), e.getRowVersion(), e.getCharacterId(), e.getVersionNumber(), e.getBible(), e.getVisualPrompt(), e.getMasterAssetId(), e.getReferenceAssetIds(), e.getStatus(), e.getLockedAt(), e.getLockedBy()); }
    public static ProjectCharacter toDomain(ProjectCharacterJpaEntity e) { return ProjectCharacter.rehydrate(e.getId(), e.getRowVersion(), e.getProjectId(), e.getCharacterId(), e.getRole(), e.getImportance(), e.getProjectAliases(), e.getStoryMetadata(), e.getGroups(), e.getPinnedCharacterVersionId(), e.getStatus()); }
    public static CharacterAppearance toDomain(CharacterAppearanceJpaEntity e) { return CharacterAppearance.rehydrate(e.getId(), e.getRowVersion(), e.getCharacterId(), e.getProjectId(), e.getTimelineKey(), e.getAgeState(), e.getHairstyle(), e.getInjury(), e.getWardrobeContext(), e.getAppearancePrompt(), e.getOutfitVersionId()); }
    public static OutfitVersion toDomain(OutfitVersionJpaEntity e) { return OutfitVersion.rehydrate(e.getId(), e.getRowVersion(), e.getCharacterId(), e.getVersionNumber(), e.getName(), e.getDescription(), e.getPrompt(), e.getStatus()); }
}
