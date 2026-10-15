package com.narrativex.backend.feature.character.api.request;

import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import java.util.List;
import java.util.UUID;

public record SetCharacterVersionReferencesRequest(List<ReferenceRequest> references) {
  public record ReferenceRequest(
      UUID assetId, String role, int priority, CharacterReferenceSlot slot) {}
}
