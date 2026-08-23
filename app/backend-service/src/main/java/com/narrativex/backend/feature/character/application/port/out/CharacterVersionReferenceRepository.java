package com.narrativex.backend.feature.character.application.port.out;

import java.util.List;
import java.util.UUID;

/** Persistence boundary for immutable media references attached to a character version. */
public interface CharacterVersionReferenceRepository {
  List<Reference> findByVersionId(Long characterVersionId);

  void replace(Long characterVersionId, List<Reference> references);

  record Reference(UUID mediaAssetId, String role, int priority) {
    public Reference {
      if (mediaAssetId == null) {
        throw new IllegalArgumentException("mediaAssetId must not be null");
      }
      if (role == null || role.isBlank()) {
        throw new IllegalArgumentException("role must not be blank");
      }
      if (priority < 0 || priority > 99) {
        throw new IllegalArgumentException("priority must be between 0 and 99");
      }
    }
  }
}
