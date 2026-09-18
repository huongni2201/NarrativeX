package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.List;

public record AnalyzedLocation(
    String aiName,
    String name,
    List<String> aliases,
    String description,
    String visualPrompt
) {
  public AnalyzedLocation {
    if (aliases == null) {
      aliases = List.of();
    }
  }
}
