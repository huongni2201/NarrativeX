package com.narrativex.backend.feature.generation.application.model.analysis;

/** Describes what is known about an analysis input's size without inventing token counts. */
public record ChapterAnalysisInputBudget(
    Accuracy accuracy, Long tokenCount, long inputBytes, long maxInputBytes) {
  public ChapterAnalysisInputBudget {
    if (accuracy == null) throw new IllegalArgumentException("accuracy must not be null");
    if (tokenCount != null && tokenCount < 0) {
      throw new IllegalArgumentException("tokenCount must not be negative");
    }
    if (inputBytes < 0 || maxInputBytes <= 0) {
      throw new IllegalArgumentException("input byte limits are invalid");
    }
    if (accuracy == Accuracy.UNKNOWN && tokenCount != null) {
      throw new IllegalArgumentException("UNKNOWN accuracy cannot carry a token count");
    }
    if (accuracy != Accuracy.UNKNOWN && tokenCount == null) {
      throw new IllegalArgumentException("Known accuracy requires a token count");
    }
  }

  public boolean exceedsByteLimit() {
    return inputBytes > maxInputBytes;
  }

  public enum Accuracy {
    EXACT,
    ESTIMATED,
    UNKNOWN
  }
}
