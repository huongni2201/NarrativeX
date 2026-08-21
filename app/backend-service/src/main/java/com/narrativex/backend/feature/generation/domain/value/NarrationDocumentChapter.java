package com.narrativex.backend.feature.generation.domain.value;

import java.util.Objects;
import java.util.UUID;

public record NarrationDocumentChapter(
    UUID chapterId,
    UUID chapterRevisionId,
    int sequence,
    int globalTextStart,
    int globalTextEnd,
    String sourceHash,
    long rowVersion) {
  public NarrationDocumentChapter {
    Objects.requireNonNull(chapterId, "chapterId");
    Objects.requireNonNull(chapterRevisionId, "chapterRevisionId");
    if (sequence < 0) throw new IllegalArgumentException("sequence must not be negative");
    if (globalTextStart < 0 || globalTextEnd < globalTextStart)
      throw new IllegalArgumentException("invalid global text offsets");
    if (sourceHash == null || !sourceHash.matches("^[0-9a-f]{64}$"))
      throw new IllegalArgumentException("sourceHash must be sha256 hex");
    if (rowVersion < 0) throw new IllegalArgumentException("rowVersion must not be negative");
  }
}
