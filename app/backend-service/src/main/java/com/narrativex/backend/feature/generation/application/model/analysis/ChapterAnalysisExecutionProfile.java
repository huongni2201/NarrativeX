package com.narrativex.backend.feature.generation.application.model.analysis;

import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import java.util.Objects;
import java.util.regex.Pattern;

/** Immutable profile that affects the generated chapter-analysis output. */
public record ChapterAnalysisExecutionProfile(
    ChapterAnalysisExecutionMode executionMode,
    String model,
    String effort,
    String promptVersion,
    String promptHash,
    String schemaVersion,
    String schemaHash) {
  private static final Pattern SHA_256 = Pattern.compile("[0-9a-f]{64}");
  private static final Pattern MODEL_SLUG = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}");

  public ChapterAnalysisExecutionProfile {
    Objects.requireNonNull(executionMode, "executionMode must not be null");
    model = required(model, "model");
    effort = required(effort, "effort");
    promptVersion = required(promptVersion, "promptVersion");
    schemaVersion = required(schemaVersion, "schemaVersion");
    promptHash = requiredHash(promptHash, "promptHash");
    schemaHash = requiredHash(schemaHash, "schemaHash");
    if (!MODEL_SLUG.matcher(model).matches()) {
      throw new IllegalArgumentException("model must be a supported model slug");
    }
    if (!effort.equals("LOW") && !effort.equals("MEDIUM") && !effort.equals("HIGH")) {
      throw new IllegalArgumentException("effort must be LOW, MEDIUM, or HIGH");
    }
  }

  private static String required(String value, String name) {
    if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
    return value.trim();
  }

  private static String requiredHash(String value, String name) {
    if (value == null || !SHA_256.matcher(value).matches()) {
      throw new IllegalArgumentException(name + " must be a lowercase SHA-256 hash");
    }
    return value;
  }
}
