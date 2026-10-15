package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import java.util.UUID;

public record CharacterVersionReferenceResponse(
    UUID assetId, String role, int priority, CharacterReferenceSlot slot) {
  public static CharacterVersionReferenceResponse from(CharacterVersionReference reference) {
    return new CharacterVersionReferenceResponse(
        reference.mediaAssetId(), reference.role(), reference.priority(), reference.slot());
  }
}
