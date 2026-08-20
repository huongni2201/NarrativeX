package com.narrativex.backend.feature.generation.domain.value;

import java.util.Objects;
import java.util.UUID;

public record NarrationPartSnapshot(UUID mediaAssetId, int sequence, String sha256, long durationMs) {
  public NarrationPartSnapshot {
    Objects.requireNonNull(mediaAssetId, "mediaAssetId");
    if (sequence < 0) throw new IllegalArgumentException("sequence must not be negative");
    if (sha256 == null || !sha256.matches("^[0-9a-f]{64}$")) throw new IllegalArgumentException("sha256 must be sha256 hex");
    if (durationMs <= 0) throw new IllegalArgumentException("durationMs must be positive");
  }
}
