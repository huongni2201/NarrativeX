package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository.Reference;
import java.util.UUID;

public record CharacterVersionReferenceResponse(UUID assetId, String role, int priority) {
  public static CharacterVersionReferenceResponse from(Reference reference) {
    return new CharacterVersionReferenceResponse(
        reference.mediaAssetId(), reference.role(), reference.priority());
  }
}
