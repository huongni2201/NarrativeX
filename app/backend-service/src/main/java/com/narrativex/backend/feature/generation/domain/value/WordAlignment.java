package com.narrativex.backend.feature.generation.domain.value;

public record WordAlignment(
    int index, int textStart, int textEnd, long audioStartMs, long audioEndMs, double confidence) {
  public WordAlignment {
    if (index < 0) throw new IllegalArgumentException("index must not be negative");
    if (textStart < 0 || textEnd <= textStart)
      throw new IllegalArgumentException("invalid word text range");
    if (audioStartMs < 0 || audioEndMs <= audioStartMs)
      throw new IllegalArgumentException("invalid word audio range");
    if (confidence < 0.0 || confidence > 1.0)
      throw new IllegalArgumentException("confidence must be between 0 and 1");
  }
}
