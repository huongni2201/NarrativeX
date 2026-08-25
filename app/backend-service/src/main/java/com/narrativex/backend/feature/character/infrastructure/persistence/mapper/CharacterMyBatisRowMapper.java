package com.narrativex.backend.feature.character.infrastructure.persistence.mapper;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.enums.OutfitVersionStatus;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterAppearanceRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.OutfitVersionRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterRow;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Component
@RequiredArgsConstructor
public class CharacterMyBatisRowMapper {
  private static final TypeReference<List<String>> STRINGS = new TypeReference<>() {};
  private final JsonMapper jsonMapper;

  public Character toDomain(CharacterRow row) {
    return Character.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getOwnerId(),
        row.getWorkspaceId(),
        row.getCanonicalName(),
        read(row.getAliasesJson(), STRINGS),
        CharacterStatus.valueOf(row.getStatus()));
  }

  public CharacterVersion toDomain(CharacterVersionRow row) {
    return CharacterVersion.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getCharacterId(),
        row.getVersionNumber(),
        row.getBible(),
        row.getVisualPrompt(),
        CharacterVersionStatus.valueOf(row.getStatus()),
        row.getLockedAt(),
        row.getLockedBy());
  }

  public OutfitVersion toDomain(OutfitVersionRow row) {
    return OutfitVersion.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getCharacterId(),
        row.getVersionNumber(),
        row.getName(),
        row.getDescription(),
        row.getPrompt(),
        OutfitVersionStatus.valueOf(row.getStatus()));
  }

  public CharacterAppearance toDomain(CharacterAppearanceRow row) {
    return CharacterAppearance.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getCharacterId(),
        row.getProjectId(),
        row.getTimelineKey(),
        row.getAgeState(),
        row.getHairstyle(),
        row.getInjury(),
        row.getWardrobeContext(),
        row.getAppearancePrompt(),
        row.getOutfitVersionId());
  }

  public ProjectCharacter toDomain(ProjectCharacterRow row) {
    return ProjectCharacter.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getProjectId(),
        row.getCharacterId(),
        row.getRole(),
        row.getImportance(),
        read(row.getProjectAliasesJson(), STRINGS),
        row.getStoryMetadata(),
        read(row.getGroupsJson(), STRINGS),
        row.getPinnedCharacterVersionId(),
        ProjectCharacterStatus.valueOf(row.getStatus()));
  }

  public CharacterRow row(Character value, InstantPair timestamps) {
    CharacterRow row = new CharacterRow();
    row.setId(value.getId());
    row.setRowVersion(value.getRowVersion());
    row.setCreatedAt(timestamps.createdAt());
    row.setUpdatedAt(timestamps.updatedAt());
    row.setOwnerId(value.getOwnerId());
    row.setWorkspaceId(value.getWorkspaceId());
    row.setCanonicalName(value.getCanonicalName());
    row.setAliasesJson(write(value.getAliases()));
    row.setStatus(value.getStatus().name());
    return row;
  }

  public CharacterVersionRow row(CharacterVersion value, InstantPair timestamps) {
    CharacterVersionRow row = new CharacterVersionRow();
    row.setId(value.getId());
    row.setRowVersion(value.getRowVersion());
    row.setCreatedAt(timestamps.createdAt());
    row.setUpdatedAt(timestamps.updatedAt());
    row.setCharacterId(value.getCharacterId());
    row.setVersionNumber(value.getVersionNumber());
    row.setBible(value.getBible());
    row.setVisualPrompt(value.getVisualPrompt());
    row.setStatus(value.getStatus().name());
    row.setLockedAt(value.getLockedAt());
    row.setLockedBy(value.getLockedBy());
    return row;
  }

  public OutfitVersionRow row(OutfitVersion value, InstantPair timestamps) {
    OutfitVersionRow row = new OutfitVersionRow();
    row.setId(value.getId());
    row.setRowVersion(value.getRowVersion());
    row.setCreatedAt(timestamps.createdAt());
    row.setUpdatedAt(timestamps.updatedAt());
    row.setCharacterId(value.getCharacterId());
    row.setVersionNumber(value.getVersionNumber());
    row.setName(value.getName());
    row.setDescription(value.getDescription());
    row.setPrompt(value.getPrompt());
    row.setStatus(value.getStatus().name());
    return row;
  }

  public CharacterAppearanceRow row(CharacterAppearance value, InstantPair timestamps) {
    CharacterAppearanceRow row = new CharacterAppearanceRow();
    row.setId(value.getId());
    row.setRowVersion(value.getRowVersion());
    row.setCreatedAt(timestamps.createdAt());
    row.setUpdatedAt(timestamps.updatedAt());
    row.setCharacterId(value.getCharacterId());
    row.setProjectId(value.getProjectId());
    row.setTimelineKey(value.getTimelineKey());
    row.setAgeState(value.getAgeState());
    row.setHairstyle(value.getHairstyle());
    row.setInjury(value.getInjury());
    row.setWardrobeContext(value.getWardrobeContext());
    row.setAppearancePrompt(value.getAppearancePrompt());
    row.setOutfitVersionId(value.getOutfitVersionId());
    return row;
  }

  public ProjectCharacterRow row(ProjectCharacter value, InstantPair timestamps) {
    ProjectCharacterRow row = new ProjectCharacterRow();
    row.setId(value.getId());
    row.setRowVersion(value.getRowVersion());
    row.setCreatedAt(timestamps.createdAt());
    row.setUpdatedAt(timestamps.updatedAt());
    row.setProjectId(value.getProjectId());
    row.setCharacterId(value.getCharacterId());
    row.setRole(value.getRole());
    row.setImportance(value.getImportance());
    row.setProjectAliasesJson(write(value.getProjectAliases()));
    row.setStoryMetadata(value.getStoryMetadata());
    row.setGroupsJson(write(value.getGroups()));
    row.setPinnedCharacterVersionId(value.getPinnedCharacterVersionId());
    row.setStatus(value.getStatus().name());
    return row;
  }

  private <T> T read(String json, TypeReference<T> type) {
    try {
      return jsonMapper.readValue(json == null || json.isBlank() ? "[]" : json, type);
    } catch (Exception e) {
      throw new IllegalStateException("Invalid character JSON", e);
    }
  }

  private String write(Object value) {
    try {
      return jsonMapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialize character JSON", e);
    }
  }

  public record InstantPair(java.time.Instant createdAt, java.time.Instant updatedAt) {
    public static InstantPair now() {
      var now = java.time.Instant.now();
      return new InstantPair(now, now);
    }
  }
}
