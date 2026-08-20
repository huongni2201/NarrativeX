package com.narrativex.backend.feature.generation.domain.value;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record NarrationDocument(
    UUID id, UUID storyId, String documentFingerprint, List<NarrationDocumentChapter> chapters) {
  public NarrationDocument {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(storyId, "storyId");
    if (documentFingerprint == null || !documentFingerprint.matches("^[0-9a-f]{64}$")) {
      throw new IllegalArgumentException("documentFingerprint must be sha256 hex");
    }
    chapters = List.copyOf(Objects.requireNonNull(chapters, "chapters"));
    if (chapters.isEmpty()) throw new IllegalArgumentException("at least one chapter is required");
    for (int index = 0; index < chapters.size(); index++) {
      if (chapters.get(index).sequence() != index) throw new IllegalArgumentException("chapter sequences must be contiguous from zero");
    }
  }

  public int selectedTextLength() {
    return chapters.stream().mapToInt(chapter -> chapter.globalTextEnd() - chapter.globalTextStart()).sum();
  }
}
