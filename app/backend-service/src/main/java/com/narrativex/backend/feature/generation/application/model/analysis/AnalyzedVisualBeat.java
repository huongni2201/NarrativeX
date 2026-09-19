package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.List;

public record AnalyzedVisualBeat(
    String title,
    String visualIntent,
    String sourceAnchor,
    List<String> characterAiNames,
    VisualDirection visualDirection) {
  public AnalyzedVisualBeat {
    if (characterAiNames == null) {
      characterAiNames = List.of();
    }
  }
}
