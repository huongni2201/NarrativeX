package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.UUID;

/** Immutable Chapter source snapshot exposed to cross-feature analysis orchestration. */
public record ChapterAnalysisSource(
    UUID chapterId,
    UUID storyVersionId,
    long rowVersion,
    String sourceHash,
    String sourceText,
    UUID contentVariantId,
    String language,
    UUID originVariantId) {
  public ChapterAnalysisSource(
      UUID chapterId, UUID storyVersionId, long rowVersion, String sourceHash, String sourceText) {
    this(chapterId, storyVersionId, rowVersion, sourceHash, sourceText, null, null, null);
  }
}
