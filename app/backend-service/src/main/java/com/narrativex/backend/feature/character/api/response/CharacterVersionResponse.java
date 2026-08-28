package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import java.time.Instant;
import java.util.UUID;

public record CharacterVersionResponse(
    UUID id,
    UUID characterId,
    int versionNumber,
    String status,
    String bible,
    String visualPrompt,
    Instant lockedAt,
    String lockedBy) {
  public static CharacterVersionResponse from(CharacterVersion version) {
    return new CharacterVersionResponse(
        version.getId(),
        version.getCharacterId(),
        version.getVersionNumber(),
        version.getStatus().name(),
        version.getBible(),
        version.getVisualPrompt(),
        version.getLockedAt(),
        version.getLockedBy());
  }
}
