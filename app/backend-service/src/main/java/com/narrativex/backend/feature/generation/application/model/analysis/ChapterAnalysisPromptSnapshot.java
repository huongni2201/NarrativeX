package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.Objects;
import java.util.UUID;

/**
 * Chapter Analysis instruction frozen at job admission. An empty instruction means the prompt
 * configuration added nothing; it is still recorded so the job's provenance is complete.
 */
public record ChapterAnalysisPromptSnapshot(
    UUID generationJobId, long settingsRevision, String instruction, String instructionHash) {
  public ChapterAnalysisPromptSnapshot {
    Objects.requireNonNull(generationJobId, "generationJobId");
    if (settingsRevision <= 0) {
      throw new IllegalArgumentException("settingsRevision must be positive");
    }
    instruction = instruction == null ? "" : instruction;
    if (instructionHash == null || !instructionHash.matches("[0-9a-f]{64}")) {
      throw new IllegalArgumentException("instructionHash must be a lowercase SHA-256 hash");
    }
  }

  public static ChapterAnalysisPromptSnapshot of(
      UUID generationJobId, long settingsRevision, String instruction) {
    String normalized = instruction == null ? "" : instruction;
    return new ChapterAnalysisPromptSnapshot(
        generationJobId, settingsRevision, normalized, CanonHashCalculator.sha256(normalized));
  }
}
