package com.narrativex.backend.feature.character.domain.value;

import java.util.UUID;

public record CharacterVersionReference(UUID mediaAssetId, String role, int priority) {
  public CharacterVersionReference {
    if (mediaAssetId == null) throw new IllegalArgumentException("mediaAssetId must not be null");
    if (role == null || role.isBlank()) throw new IllegalArgumentException("role must not be blank");
    if (priority < 0 || priority > 99)
      throw new IllegalArgumentException("priority must be between 0 and 99");
  }
}
