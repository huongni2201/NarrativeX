package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisUsageState;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Durable telemetry and provenance record for a completed chapter analysis run. Follows ADR-0009.
 */
public record ChapterAnalysisRun(
    UUID id,
    UUID generationJobId,
    UUID chapterId,
    UUID storyboardRevisionId,
    String sourceHash,
    String model,
    String promptVersion,
    String schemaVersion,
    Long promptTokens,
    Long outputTokens,
    Long thinkingTokens,
    Long cachedTokens,
    Long totalTokens,
    Long runtimeMs,
    String canonHash,
    Instant createdAt,
    ChapterAnalysisUsageState usageState,
    ChapterAnalysisExecutionMode executionMode,
    UUID attemptId,
    UUID credentialRef,
    String adapterVersion,
    String conversationId,
    String modelObserved,
    String effortObserved,
    String promptHash,
    String schemaHash,
    String outputHash) {
  private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");

  public ChapterAnalysisRun {
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    Objects.requireNonNull(sourceHash, "sourceHash must not be null");
    Objects.requireNonNull(model, "model must not be null");
    Objects.requireNonNull(promptVersion, "promptVersion must not be null");
    Objects.requireNonNull(schemaVersion, "schemaVersion must not be null");
    Objects.requireNonNull(canonHash, "canonHash must not be null");
    Objects.requireNonNull(usageState, "usageState must not be null");
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
    if (runtimeMs != null && runtimeMs < 0)
      throw new IllegalArgumentException("runtimeMs must be non-negative");
    requireOptionalHash(promptHash, "promptHash");
    requireOptionalHash(schemaHash, "schemaHash");
    requireOptionalHash(outputHash, "outputHash");
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  /** Retains the original constructor for legacy fixtures without usage metadata. */
  public ChapterAnalysisRun(
      UUID id,
      UUID generationJobId,
      UUID chapterId,
      UUID storyboardRevisionId,
      String sourceHash,
      String model,
      String promptVersion,
      String schemaVersion,
      long promptTokens,
      long outputTokens,
      long thinkingTokens,
      long cachedTokens,
      long totalTokens,
      long runtimeMs,
      String canonHash,
      Instant createdAt) {
    this(
        id,
        generationJobId,
        chapterId,
        storyboardRevisionId,
        sourceHash,
        model,
        promptVersion,
        schemaVersion,
        promptTokens,
        outputTokens,
        thinkingTokens,
        cachedTokens,
        totalTokens,
        runtimeMs,
        canonHash,
        createdAt,
        ChapterAnalysisUsageState.LEGACY_UNSPECIFIED,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }

  private static void requireOptionalHash(String value, String field) {
    if (value != null && !SHA_256.matcher(value).matches()) {
      throw new IllegalArgumentException(field + " must be a lowercase SHA-256 hash");
    }
  }
}
