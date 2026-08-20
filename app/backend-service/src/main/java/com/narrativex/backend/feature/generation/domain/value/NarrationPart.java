package com.narrativex.backend.feature.generation.domain.value;

import java.util.Objects;
import java.util.UUID;

public record NarrationPart(
    UUID id, UUID narrationSetId, UUID mediaAssetId, int sequence, long durationMs, String sha256) {
  public NarrationPart {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(narrationSetId, "narrationSetId");
    Objects.requireNonNull(mediaAssetId, "mediaAssetId");
    if (sequence < 0) throw new IllegalArgumentException("sequence must not be negative");
    if (durationMs <= 0) throw new IllegalArgumentException("durationMs must be positive");
    if (sha256 == null || !sha256.matches("^[0-9a-f]{64}$")) {
      throw new IllegalArgumentException("sha256 must be lowercase sha256 hex");
    }
  }
}
