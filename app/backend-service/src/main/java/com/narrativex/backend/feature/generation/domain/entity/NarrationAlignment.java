package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.generation.domain.value.WordAlignment;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record NarrationAlignment(
    UUID id,
    UUID narrationAssetId,
    String sourceHash,
    String alignmentVersion,
    List<WordAlignment> words) {
  public NarrationAlignment {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(narrationAssetId, "narrationAssetId");
    if (sourceHash == null || sourceHash.isBlank())
      throw new IllegalArgumentException("sourceHash must not be blank");
    if (alignmentVersion == null || alignmentVersion.isBlank())
      throw new IllegalArgumentException("alignmentVersion must not be blank");
    words = List.copyOf(Objects.requireNonNull(words, "words"));
    validateWords(words);
  }

  public void requireWithinDuration(long actualDurationMs) {
    if (actualDurationMs <= 0)
      throw new IllegalArgumentException("actualDurationMs must be positive");
    if (words.getLast().audioEndMs() > actualDurationMs)
      throw new IllegalArgumentException("word alignment exceeds narration duration");
  }

  private static void validateWords(List<WordAlignment> words) {
    if (words.isEmpty()) throw new IllegalArgumentException("word alignment must not be empty");
    for (int index = 0; index < words.size(); index++) {
      WordAlignment current = words.get(index);
      if (current.index() != index)
        throw new IllegalArgumentException("word alignment indexes must be contiguous");
      if (index == 0) continue;
      WordAlignment previous = words.get(index - 1);
      if (previous.textEnd() > current.textStart())
        throw new IllegalArgumentException("word text ranges overlap");
      if (previous.audioEndMs() > current.audioStartMs())
        throw new IllegalArgumentException("word audio ranges overlap");
    }
  }
}
