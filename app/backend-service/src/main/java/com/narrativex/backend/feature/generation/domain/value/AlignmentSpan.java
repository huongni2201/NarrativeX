package com.narrativex.backend.feature.generation.domain.value;

public record AlignmentSpan(
    int index, int textStart, int textEnd, long audioStartMs, long audioEndMs) {
  public AlignmentSpan {
    if (index < 0) throw new IllegalArgumentException("index must not be negative");
    if (textStart < 0 || textEnd < textStart) throw new IllegalArgumentException("invalid text span");
    if (audioStartMs < 0 || audioEndMs <= audioStartMs)
      throw new IllegalArgumentException("invalid audio span");
  }
}
