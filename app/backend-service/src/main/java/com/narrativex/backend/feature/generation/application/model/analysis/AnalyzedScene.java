package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.List;

public record AnalyzedScene(
    String title,
    String narration,
    String locationAiName,
    List<String> characterAiNames,
    List<AnalyzedVisualBeat> visualBeats) {
  public AnalyzedScene {
    if (characterAiNames == null) {
      characterAiNames = List.of();
    }
    if (visualBeats == null) {
      visualBeats = List.of();
    }
  }
}
