package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.List;

public record ChapterAnalysisEnvelope(
    ChapterCanon canon,
    List<AnalyzedScene> scenes
) {
  public ChapterAnalysisEnvelope {
    if (canon == null) {
      canon = new ChapterCanon(List.of(), List.of());
    }
    if (scenes == null) {
      scenes = List.of();
    }
  }
}
