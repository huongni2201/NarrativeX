package com.narrativex.backend.feature.generation.domain.value;

import com.narrativex.backend.feature.generation.domain.enums.AlignmentStatus;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record NarrationTimeline(
    UUID narrationDocumentId,
    UUID narrationSetId,
    String documentFingerprint,
    String narrationFingerprint,
    long totalDurationMs,
    List<NarrationPartTimeline> parts,
    List<NarrationSpan> spans,
    double coverage,
    double confidence,
    AlignmentStatus status) {
  public NarrationTimeline {
    Objects.requireNonNull(narrationDocumentId, "narrationDocumentId");
    Objects.requireNonNull(narrationSetId, "narrationSetId");
    if (documentFingerprint == null || !documentFingerprint.matches("^[0-9a-f]{64}$"))
      throw new IllegalArgumentException("documentFingerprint must be sha256 hex");
    if (narrationFingerprint == null || !narrationFingerprint.matches("^[0-9a-f]{64}$"))
      throw new IllegalArgumentException("narrationFingerprint must be sha256 hex");
    if (totalDurationMs <= 0)
      throw new IllegalArgumentException("totalDurationMs must be positive");
    parts = List.copyOf(Objects.requireNonNull(parts, "parts"));
    spans = List.copyOf(Objects.requireNonNull(spans, "spans"));
    if (coverage < 0 || coverage > 1)
      throw new IllegalArgumentException("coverage must be between zero and one");
    if (confidence < 0 || confidence > 1)
      throw new IllegalArgumentException("confidence must be between zero and one");
    Objects.requireNonNull(status, "status");
  }
}
