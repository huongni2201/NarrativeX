package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.List;

public record AnalyzedCharacter(
    String aiName,
    String canonicalName,
    List<String> aliases,
    String role,
    String importance,
    String description,
    String visualPrompt) {
  public AnalyzedCharacter {
    if (aliases == null) {
      aliases = List.of();
    }
    if (role == null || role.isBlank()) {
      role = "SUPPORTING";
    }
    if (importance == null || importance.isBlank()) {
      importance = "SECONDARY";
    }
  }
}
