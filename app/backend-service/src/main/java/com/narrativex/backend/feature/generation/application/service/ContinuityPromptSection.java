package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.BeatContinuity;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.ObjectMapper;

/** Formats immutable beat continuity state without re-interpreting story semantics. */
public final class ContinuityPromptSection {
  private final ObjectMapper objectMapper;

  public ContinuityPromptSection(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String render(BeatContinuity continuity) {
    if (continuity == null) return "";

    List<String> entry = facts(continuity.entryFactsJson());
    List<String> visible = facts(continuity.visibleFactsJson());
    if (entry.isEmpty() && visible.isEmpty()) return "";

    StringBuilder section = new StringBuilder("\n\nPINNED CONTINUITY");
    if (hasText(continuity.timelineKey())) {
      section.append("\nTimeline: ").append(continuity.timelineKey().trim());
    }
    if (!entry.isEmpty()) {
      section.append("\nEstablished entry state:");
      entry.forEach(value -> section.append("\n- ").append(value));
    }
    if (!visible.isEmpty()) {
      section.append("\nCurrent visible state:");
      visible.forEach(value -> section.append("\n- ").append(value));
    }
    section.append(
        "\nPinned continuity is authoritative for this beat and overrides generic canon state when they differ.");
    return section.toString();
  }

  private List<String> facts(String json) {
    if (!hasText(json)) return List.of();
    try {
      Object decoded = objectMapper.readValue(json, Object.class);
      if (!(decoded instanceof List<?> items)) return List.of();
      List<String> result = new ArrayList<>();
      for (Object item : items) {
        if (!(item instanceof Map<?, ?> fact)) continue;
        Object provenance = fact.get("provenance");
        Object value = fact.get("value");
        if ("UNKNOWN".equals(String.valueOf(provenance)) || value == null) continue;
        String subject = text(fact.get("subjectKey"));
        String predicate = text(fact.get("predicate"));
        if (subject == null || predicate == null) continue;
        result.add(subject + " " + predicate + " = " + value);
      }
      return List.copyOf(result);
    } catch (Exception exception) {
      throw new IllegalArgumentException("pinned continuity JSON is invalid", exception);
    }
  }

  private static String text(Object value) {
    return value == null || value.toString().isBlank() ? null : value.toString().trim();
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
