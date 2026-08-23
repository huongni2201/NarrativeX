package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import java.util.List;
import java.util.UUID;

public record CharacterSummaryResponse(
    UUID id,
    String workspaceId,
    String canonicalName,
    List<String> aliases,
    CharacterStatus status,
    long rowVersion) {

  public static CharacterSummaryResponse from(Character character) {
    return new CharacterSummaryResponse(
        character.getId(),
        character.getWorkspaceId(),
        character.getCanonicalName(),
        character.getAliases(),
        character.getStatus(),
        character.getRowVersion());
  }
}
