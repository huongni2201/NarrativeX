package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.Objects;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/** Frozen prompt and output schema for one Chapter Analysis stage. */
public record ChapterAnalysisStageContract(
    String promptTemplate, JsonNode responseSchema, String promptHash, String schemaHash) {
  private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");

  public ChapterAnalysisStageContract {
    if (promptTemplate == null || promptTemplate.isBlank()) {
      throw new IllegalArgumentException("stage promptTemplate must not be blank");
    }
    Objects.requireNonNull(responseSchema, "stage responseSchema must not be null");
    if (!responseSchema.isObject() || responseSchema.isEmpty()) {
      throw new IllegalArgumentException("stage responseSchema must be a non-empty object");
    }
    requireHash(promptHash, "promptHash");
    requireHash(schemaHash, "schemaHash");
    responseSchema = responseSchema.deepCopy();
  }

  @Override
  public JsonNode responseSchema() {
    return responseSchema.deepCopy();
  }

  private static void requireHash(String value, String name) {
    if (value == null || !SHA_256.matcher(value).matches()) {
      throw new IllegalArgumentException(name + " must be a lowercase SHA-256 hash");
    }
  }
}
