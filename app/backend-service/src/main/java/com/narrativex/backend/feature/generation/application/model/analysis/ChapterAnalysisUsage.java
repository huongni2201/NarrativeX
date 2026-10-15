package com.narrativex.backend.feature.generation.application.model.analysis;

import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisUsageState;

/** Detailed token usage and timing telemetry for chapter analysis calls. */
public record ChapterAnalysisUsage(
    Long promptTokens,
    Long outputTokens,
    Long thinkingTokens,
    Long cachedTokens,
    Long totalTokens,
    long runtimeMs) {

  public ChapterAnalysisUsage {
    if (promptTokens != null && promptTokens < 0)
      throw new IllegalArgumentException("promptTokens must be non-negative");
    if (outputTokens != null && outputTokens < 0)
      throw new IllegalArgumentException("outputTokens must be non-negative");
    if (thinkingTokens != null && thinkingTokens < 0)
      throw new IllegalArgumentException("thinkingTokens must be non-negative");
    if (cachedTokens != null && cachedTokens < 0)
      throw new IllegalArgumentException("cachedTokens must be non-negative");
    if (totalTokens != null && totalTokens < 0)
      throw new IllegalArgumentException("totalTokens must be non-negative");
    if (runtimeMs < 0) throw new IllegalArgumentException("runtimeMs must be non-negative");
  }

  /** Keeps existing callers that pass primitive token counts source-compatible. */
  public ChapterAnalysisUsage(
      long promptTokens,
      long outputTokens,
      long thinkingTokens,
      long cachedTokens,
      long totalTokens,
      long runtimeMs) {
    this(
        Long.valueOf(promptTokens),
        Long.valueOf(outputTokens),
        Long.valueOf(thinkingTokens),
        Long.valueOf(cachedTokens),
        Long.valueOf(totalTokens),
        runtimeMs);
  }

  public static ChapterAnalysisUsage zero() {
    return new ChapterAnalysisUsage(0L, 0L, 0L, 0L, 0L, 0);
  }

  public ChapterAnalysisUsageState usageState() {
    int present =
        (promptTokens == null ? 0 : 1)
            + (outputTokens == null ? 0 : 1)
            + (thinkingTokens == null ? 0 : 1)
            + (cachedTokens == null ? 0 : 1)
            + (totalTokens == null ? 0 : 1);
    if (present == 0) return ChapterAnalysisUsageState.UNKNOWN;
    return present == 5 ? ChapterAnalysisUsageState.REPORTED : ChapterAnalysisUsageState.PARTIAL;
  }
}
