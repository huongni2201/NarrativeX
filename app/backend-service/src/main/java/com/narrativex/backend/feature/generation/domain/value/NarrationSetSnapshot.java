package com.narrativex.backend.feature.generation.domain.value;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record NarrationSetSnapshot(UUID narrationSetId, String narrationFingerprint, List<NarrationPartSnapshot> parts) {
  public NarrationSetSnapshot {
    Objects.requireNonNull(narrationSetId, "narrationSetId");
    if (narrationFingerprint == null || !narrationFingerprint.matches("^[0-9a-f]{64}$")) throw new IllegalArgumentException("narrationFingerprint must be sha256 hex");
    parts = List.copyOf(Objects.requireNonNull(parts, "parts"));
    for (int index = 0; index < parts.size(); index++) {
      if (parts.get(index).sequence() != index) throw new IllegalArgumentException("part sequences must be contiguous from zero");
    }
  }

  public long totalDurationMs() {
    return parts.stream().mapToLong(NarrationPartSnapshot::durationMs).sum();
  }
}
