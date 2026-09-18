package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.Objects;

/**
 * Result of a chapter analysis execution containing the structured JSON and usage telemetry.
 */
public record ChapterAnalysisResult(
    String rawJson,
    ChapterAnalysisUsage usage,
    String model,
    String canonHash) {

  public ChapterAnalysisResult {
    Objects.requireNonNull(rawJson, "rawJson must not be null");
    Objects.requireNonNull(usage, "usage must not be null");
    Objects.requireNonNull(model, "model must not be null");
  }
}
