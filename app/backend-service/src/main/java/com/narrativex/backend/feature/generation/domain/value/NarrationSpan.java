package com.narrativex.backend.feature.generation.domain.value;

import java.util.Objects;
import java.util.UUID;

public record NarrationSpan(
    UUID chapterRevisionId,
    int chapterTextStart,
    int chapterTextEnd,
    int globalTextStart,
    int globalTextEnd,
    long globalAudioStartMs,
    long globalAudioEndMs,
    double confidence) {
  public NarrationSpan {
    Objects.requireNonNull(chapterRevisionId, "chapterRevisionId");
    if (chapterTextStart < 0 || chapterTextEnd < chapterTextStart)
      throw new IllegalArgumentException("invalid chapter text span");
    if (globalTextStart < 0 || globalTextEnd < globalTextStart)
      throw new IllegalArgumentException("invalid global text span");
    if (globalAudioStartMs < 0 || globalAudioEndMs <= globalAudioStartMs)
      throw new IllegalArgumentException("invalid audio span");
    if (confidence < 0 || confidence > 1)
      throw new IllegalArgumentException("confidence must be between zero and one");
  }
}
