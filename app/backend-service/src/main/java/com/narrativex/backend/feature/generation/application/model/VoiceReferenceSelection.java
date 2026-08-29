package com.narrativex.backend.feature.generation.application.model;

import com.narrativex.backend.feature.generation.domain.enums.VoiceReferenceScope;
import java.util.Objects;
import java.util.UUID;

public record VoiceReferenceSelection(VoiceReferenceScope scope, UUID assetId) {
  public VoiceReferenceSelection {
    Objects.requireNonNull(scope, "scope");
    Objects.requireNonNull(assetId, "assetId");
  }
}
