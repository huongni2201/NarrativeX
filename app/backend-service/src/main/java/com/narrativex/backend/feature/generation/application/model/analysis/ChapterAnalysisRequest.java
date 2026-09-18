package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.Objects;
import java.util.UUID;

/**
 * Domain-aligned request for analyzing a chapter's source text into a structured storyboard
 * envelope.
 */
public record ChapterAnalysisRequest(
    UUID projectId,
    UUID chapterId,
    UUID storyboardRevisionId,
    String sourceText,
    String sourceLanguage,
    String promptVersion,
    String schemaVersion,
    String previousCanonHash,
    String projectBible) {

  public ChapterAnalysisRequest {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    if (sourceText == null || sourceText.isBlank()) {
      throw new IllegalArgumentException("sourceText must not be blank");
    }
    if (sourceLanguage == null || sourceLanguage.isBlank()) {
      sourceLanguage = "vi";
    }
    if (promptVersion == null || promptVersion.isBlank()) {
      promptVersion = "1.0";
    }
    if (schemaVersion == null || schemaVersion.isBlank()) {
      schemaVersion = "1.0";
    }
  }

  public static ChapterAnalysisRequest simple(
      UUID projectId, UUID chapterId, String sourceText, String sourceLanguage) {
    return new ChapterAnalysisRequest(
        projectId, chapterId, null, sourceText, sourceLanguage, "1.0", "1.0", null, null);
  }
}
