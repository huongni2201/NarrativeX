package com.narrativex.backend.feature.character.domain.value;

import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import java.util.UUID;

public record CharacterVersionReference(
    UUID mediaAssetId, String role, int priority, CharacterReferenceSlot slot) {
  public CharacterVersionReference(UUID mediaAssetId, String role, int priority) {
    this(mediaAssetId, role, priority, null);
  }

  public CharacterVersionReference {
    if (mediaAssetId == null) throw new IllegalArgumentException("mediaAssetId must not be null");
    if (role == null || role.isBlank())
      throw new IllegalArgumentException("role must not be blank");
    if (priority < 0 || priority > 99)
      throw new IllegalArgumentException("priority must be between 0 and 99");
    if (slot != null && (!slot.role().equalsIgnoreCase(role) || slot.priority() != priority)) {
      throw new IllegalArgumentException("role and priority must match the reference slot");
    }
  }
}
