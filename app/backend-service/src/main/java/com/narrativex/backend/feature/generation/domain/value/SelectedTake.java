package com.narrativex.backend.feature.generation.domain.value;

import java.util.Objects;
import java.util.UUID;

/** Value object binding a validated Take to a Shot with in/out editing trimming. */
public record SelectedTake(UUID shotId, UUID takeId, long sourceInMs, long sourceOutMs) {
  public SelectedTake {
    Objects.requireNonNull(shotId, "shotId must not be null");
    Objects.requireNonNull(takeId, "takeId must not be null");
    if (sourceInMs < 0) {
      throw new IllegalArgumentException("sourceInMs must not be negative");
    }
    if (sourceOutMs <= sourceInMs) {
      throw new IllegalArgumentException("sourceOutMs must be strictly greater than sourceInMs");
    }
  }

  public long editDurationMs() {
    return sourceOutMs - sourceInMs;
  }
}
