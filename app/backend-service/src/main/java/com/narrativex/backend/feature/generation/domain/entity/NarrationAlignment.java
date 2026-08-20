package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.generation.domain.value.AlignmentSpan;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record NarrationAlignment(
    UUID id,
    UUID narrationAssetId,
    String sourceHash,
    String alignmentVersion,
    List<AlignmentSpan> spans) {
  public NarrationAlignment {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(narrationAssetId, "narrationAssetId");
    if (sourceHash == null || sourceHash.isBlank()) throw new IllegalArgumentException("sourceHash must not be blank");
    if (alignmentVersion == null || alignmentVersion.isBlank()) throw new IllegalArgumentException("alignmentVersion must not be blank");
    spans = List.copyOf(Objects.requireNonNull(spans, "spans"));
    validateSpans(spans);
  }

  public void requireDuration(long actualDurationMs, long toleranceMs) {
    if (actualDurationMs <= 0) throw new IllegalArgumentException("actualDurationMs must be positive");
    if (toleranceMs < 0) throw new IllegalArgumentException("toleranceMs must not be negative");
    long drift = Math.abs(spans.getLast().audioEndMs() - actualDurationMs);
    if (drift > toleranceMs) throw new IllegalArgumentException("alignment duration drift exceeds tolerance");
  }

  private static void validateSpans(List<AlignmentSpan> spans) {
    if (spans.isEmpty()) throw new IllegalArgumentException("alignment spans must not be empty");
    if (spans.getFirst().audioStartMs() != 0) throw new IllegalArgumentException("alignment must start at 0ms");
    for (int index = 1; index < spans.size(); index++) {
      AlignmentSpan previous = spans.get(index - 1);
      AlignmentSpan current = spans.get(index);
      if (previous.textEnd() > current.textStart()) throw new IllegalArgumentException("alignment text spans overlap");
      if (previous.audioEndMs() > current.audioStartMs()) throw new IllegalArgumentException("alignment audio spans overlap");
    }
  }
}
