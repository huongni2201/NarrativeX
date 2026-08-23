package com.narrativex.backend.feature.character.api.request;

import java.util.List;
import java.util.UUID;

public record SetCharacterVersionReferencesRequest(List<ReferenceRequest> references) {
  public record ReferenceRequest(UUID assetId, String role, int priority) {}
}
