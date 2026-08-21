package com.narrativex.backend.feature.generation.domain.value;

import com.narrativex.backend.feature.generation.domain.enums.NarrationStrategy;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record NarrationPlan(
    NarrationStrategy strategy,
    UUID narrationDocumentId,
    UUID narrationSetId,
    String documentFingerprint,
    String narrationFingerprint,
    List<NarrationPartSnapshot> parts) {
  public NarrationPlan {
    Objects.requireNonNull(strategy, "strategy");
    Objects.requireNonNull(narrationDocumentId, "narrationDocumentId");
    Objects.requireNonNull(narrationSetId, "narrationSetId");
    if (documentFingerprint == null || !documentFingerprint.matches("^[0-9a-f]{64}$"))
      throw new IllegalArgumentException("documentFingerprint must be sha256 hex");
    if (narrationFingerprint == null || !narrationFingerprint.matches("^[0-9a-f]{64}$"))
      throw new IllegalArgumentException("narrationFingerprint must be sha256 hex");
    parts = List.copyOf(Objects.requireNonNull(parts, "parts"));
  }

  public boolean createsTtsOperation() {
    return strategy == NarrationStrategy.TTS;
  }
}
