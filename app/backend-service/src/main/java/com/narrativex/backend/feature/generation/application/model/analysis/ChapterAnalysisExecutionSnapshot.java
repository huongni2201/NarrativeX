package com.narrativex.backend.feature.generation.application.model.analysis;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/** Frozen output-affecting analysis profile and contract for one durable generation job. */
public record ChapterAnalysisExecutionSnapshot(
    UUID generationJobId,
    ChapterAnalysisExecutionProfile profile,
    String promptTemplate,
    JsonNode responseSchema,
    String inputFingerprint,
    long configRevision,
    Instant createdAt) {
  private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");

  public ChapterAnalysisExecutionSnapshot {
    Objects.requireNonNull(generationJobId, "generationJobId must not be null");
    Objects.requireNonNull(profile, "profile must not be null");
    if (promptTemplate == null || promptTemplate.isBlank()) {
      throw new IllegalArgumentException("promptTemplate must not be blank");
    }
    Objects.requireNonNull(responseSchema, "responseSchema must not be null");
    if (!responseSchema.isObject() || responseSchema.isEmpty()) {
      throw new IllegalArgumentException("responseSchema must be a non-empty object");
    }
    if (inputFingerprint == null || !SHA_256.matcher(inputFingerprint).matches()) {
      throw new IllegalArgumentException("inputFingerprint must be a lowercase SHA-256 hash");
    }
    if (configRevision <= 0) throw new IllegalArgumentException("configRevision must be positive");
    responseSchema = responseSchema.deepCopy();
    if (createdAt == null) createdAt = Instant.now();
  }
}
