package com.narrativex.backend.feature.generation.application.model.analysis;

/** Detailed token usage and timing telemetry for chapter analysis calls. */
public record ChapterAnalysisUsage(
    long promptTokens,
    long outputTokens,
    long thinkingTokens,
    long cachedTokens,
    long totalTokens,
    long runtimeMs) {

  public ChapterAnalysisUsage {
    if (promptTokens < 0) throw new IllegalArgumentException("promptTokens must be non-negative");
    if (outputTokens < 0) throw new IllegalArgumentException("outputTokens must be non-negative");
    if (thinkingTokens < 0)
      throw new IllegalArgumentException("thinkingTokens must be non-negative");
    if (cachedTokens < 0) throw new IllegalArgumentException("cachedTokens must be non-negative");
    if (totalTokens < 0) throw new IllegalArgumentException("totalTokens must be non-negative");
    if (runtimeMs < 0) throw new IllegalArgumentException("runtimeMs must be non-negative");
  }

  public static ChapterAnalysisUsage zero() {
    return new ChapterAnalysisUsage(0, 0, 0, 0, 0, 0);
  }
}
