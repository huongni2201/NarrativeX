package com.narrativex.backend.feature.generation.domain.value;

import com.narrativex.backend.feature.generation.domain.enums.NarrationSetStatus;
import com.narrativex.backend.feature.generation.domain.enums.NarrationSource;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record NarrationSet(
    UUID id,
    UUID storyId,
    NarrationSource source,
    NarrationSetStatus status,
    String narrationFingerprint,
    long totalDurationMs,
    List<NarrationPart> parts) {
  public NarrationSet {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(storyId, "storyId");
    Objects.requireNonNull(source, "source");
    Objects.requireNonNull(status, "status");
    if (narrationFingerprint == null || !narrationFingerprint.matches("^[0-9a-f]{64}$")) {
      throw new IllegalArgumentException("narrationFingerprint must be sha256 hex");
    }
    if (totalDurationMs < 0)
      throw new IllegalArgumentException("totalDurationMs must not be negative");
    parts = List.copyOf(Objects.requireNonNull(parts, "parts"));
    validateParts(id, parts);
    long calculatedDuration = parts.stream().mapToLong(NarrationPart::durationMs).sum();
    if (calculatedDuration != totalDurationMs) {
      throw new IllegalArgumentException("totalDurationMs must equal the sum of part durations");
    }
  }

  private static void validateParts(UUID setId, List<NarrationPart> parts) {
    for (int index = 0; index < parts.size(); index++) {
      NarrationPart part = parts.get(index);
      if (!setId.equals(part.narrationSetId()))
        throw new IllegalArgumentException("part belongs to another narration set");
      if (part.sequence() != index)
        throw new IllegalArgumentException("part sequences must be contiguous from zero");
    }
  }
}
