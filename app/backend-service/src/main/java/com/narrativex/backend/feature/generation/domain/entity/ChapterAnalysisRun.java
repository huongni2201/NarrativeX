package com.narrativex.backend.feature.generation.domain.entity;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Durable telemetry and provenance record for a completed chapter analysis run.
 * Follows ADR-0022.
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
    long promptTokens,
    long outputTokens,
    long thinkingTokens,
    long cachedTokens,
    long totalTokens,
    long runtimeMs,
    String canonHash,
    Instant createdAt) {

  public ChapterAnalysisRun {
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    Objects.requireNonNull(sourceHash, "sourceHash must not be null");
    Objects.requireNonNull(model, "model must not be null");
    Objects.requireNonNull(promptVersion, "promptVersion must not be null");
    Objects.requireNonNull(schemaVersion, "schemaVersion must not be null");
    Objects.requireNonNull(canonHash, "canonHash must not be null");
    if (promptTokens < 0) throw new IllegalArgumentException("promptTokens must be non-negative");
    if (outputTokens < 0) throw new IllegalArgumentException("outputTokens must be non-negative");
    if (thinkingTokens < 0)
      throw new IllegalArgumentException("thinkingTokens must be non-negative");
    if (cachedTokens < 0) throw new IllegalArgumentException("cachedTokens must be non-negative");
    if (totalTokens < 0) throw new IllegalArgumentException("totalTokens must be non-negative");
    if (runtimeMs < 0) throw new IllegalArgumentException("runtimeMs must be non-negative");
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }
}
