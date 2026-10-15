package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
import java.time.Instant;
import java.util.UUID;

public record CharacterVersionResponse(
    UUID id,
    UUID characterId,
    int versionNumber,
    String status,
    String bible,
    String visualPrompt,
    String referencePolicy,
    CharacterVisualProfile visualProfile,
    UUID basedOnVersionId,
    Instant lockedAt) {
  public static CharacterVersionResponse from(CharacterVersion version) {
    return new CharacterVersionResponse(
        version.getId(),
        version.getCharacterId(),
        version.getVersionNumber(),
        version.getStatus().name(),
        version.getBible(),
        version.getVisualPrompt(),
        version.getReferencePolicy().name(),
        version.getVisualProfile(),
        version.getBasedOnVersionId(),
        version.getLockedAt());
  }
}
