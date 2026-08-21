package com.narrativex.backend.feature.generation.domain.value;

import java.util.Objects;
import java.util.UUID;

public record NarrationPartTimeline(
    UUID mediaAssetId, int sequence, long globalStartMs, long globalEndMs, long localDurationMs) {
  public NarrationPartTimeline {
    Objects.requireNonNull(mediaAssetId, "mediaAssetId");
    if (sequence < 0) throw new IllegalArgumentException("sequence must not be negative");
    if (globalStartMs < 0 || globalEndMs <= globalStartMs)
      throw new IllegalArgumentException("invalid global audio span");
    if (localDurationMs != globalEndMs - globalStartMs)
      throw new IllegalArgumentException("localDurationMs must match global span");
  }
}
