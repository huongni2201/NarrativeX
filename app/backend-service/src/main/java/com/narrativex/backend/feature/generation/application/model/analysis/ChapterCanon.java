package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.List;

public record ChapterCanon(List<AnalyzedCharacter> characters, List<AnalyzedLocation> locations) {
  public ChapterCanon {
    if (characters == null) {
      characters = List.of();
    }
    if (locations == null) {
      locations = List.of();
    }
  }
}
