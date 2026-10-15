package com.narrativex.backend.feature.generation.application.model.analysis;

import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import java.util.Objects;

/** Installation-wide desired settings for chapter-analysis admission and execution. */
public record AnalysisRuntimeConfiguration(
    long revision,
    ChapterAnalysisExecutionMode executionMode,
    String model,
    String effort,
    int maxConcurrentAnalyses,
    int maxQueuedAnalyses,
    long maxInputBytes,
    long maxOutputBytes,
    long maxRuntimeMs,
    long rowVersion) {
  public AnalysisRuntimeConfiguration {
    if (revision <= 0) throw new IllegalArgumentException("revision must be positive");
    Objects.requireNonNull(executionMode, "executionMode must not be null");
    if (model == null || model.isBlank()) throw new IllegalArgumentException("model is required");
    if (!"LOW".equals(effort) && !"MEDIUM".equals(effort) && !"HIGH".equals(effort)) {
      throw new IllegalArgumentException("effort must be LOW, MEDIUM, or HIGH");
    }
    if (maxConcurrentAnalyses < 1 || maxConcurrentAnalyses > 32) {
      throw new IllegalArgumentException("maxConcurrentAnalyses must be between 1 and 32");
    }
    if (maxQueuedAnalyses < 0 || maxQueuedAnalyses > 1000) {
      throw new IllegalArgumentException("maxQueuedAnalyses must be between 0 and 1000");
    }
    if (maxInputBytes < 1024 || maxInputBytes > 20_000_000) {
      throw new IllegalArgumentException("maxInputBytes is outside the supported range");
    }
    if (maxOutputBytes < 1024 || maxOutputBytes > 16_777_216) {
      throw new IllegalArgumentException("maxOutputBytes is outside the supported range");
    }
    if (maxRuntimeMs < 1000 || maxRuntimeMs > 3_600_000) {
      throw new IllegalArgumentException("maxRuntimeMs is outside the supported range");
    }
    if (rowVersion < 0) throw new IllegalArgumentException("rowVersion must not be negative");
  }
}
