package com.narrativex.backend.feature.generation.application.model.analysis;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Robust, schema-agnostic parser for narrative canon (characters, locations) extracted during
 * chapter analysis.
 */
public final class ChapterCanonParser {
  private static final JsonMapper MAPPER = JsonMapper.builder().build();

  private ChapterCanonParser() {}

  public static ChapterCanon parse(String json) {
    if (json == null || json.isBlank()) {
      return new ChapterCanon(List.of(), List.of());
    }
    try {
      JsonNode root = MAPPER.readTree(json);
      return parse(root);
    } catch (Exception e) {
      return new ChapterCanon(List.of(), List.of());
    }
  }

  public static ChapterCanon parse(JsonNode node) {
    if (node == null || node.isNull()) {
      return new ChapterCanon(List.of(), List.of());
    }
    JsonNode canonNode = node;
    if (node.has("canon") && node.get("canon").isObject()) {
      canonNode = node.get("canon");
    }

    List<AnalyzedCharacter> characters = new ArrayList<>();
    JsonNode charArr = firstArray(canonNode, "characters", "narrative_characters");
    if (charArr != null) {
      for (JsonNode c : charArr) {
        String aiName = text(c, "ai_name", text(c, "aiName", null));
        if (aiName == null || aiName.isBlank()) continue;
        String canonicalName =
            text(c, "canonical_name", text(c, "canonicalName", text(c, "name", aiName)));
        String description = text(c, "description", "");
        String visualPrompt = text(c, "visual_prompt", text(c, "visualPrompt", ""));
        String role = text(c, "role", "SUPPORTING");
        String importance = text(c, "importance", "SECONDARY");
        List<String> aliases = parseStringList(c.get("aliases"));
        characters.add(
            new AnalyzedCharacter(
                aiName.trim(),
                canonicalName.trim(),
                aliases,
                role.trim(),
                importance.trim(),
                description.trim(),
                visualPrompt.trim()));
      }
    }

    List<AnalyzedLocation> locations = new ArrayList<>();
    JsonNode locArr = firstArray(canonNode, "locations", "narrative_locations");
    if (locArr != null) {
      for (JsonNode l : locArr) {
        String aiName = text(l, "ai_name", text(l, "aiName", null));
        if (aiName == null || aiName.isBlank()) continue;
        String name = text(l, "canonical_name", text(l, "canonicalName", text(l, "name", aiName)));
        String description = text(l, "description", "");
        String visualPrompt = text(l, "visual_prompt", text(l, "visualPrompt", ""));
        List<String> aliases = parseStringList(l.get("aliases"));
        locations.add(
            new AnalyzedLocation(
                aiName.trim(), name.trim(), aliases, description.trim(), visualPrompt.trim()));
      }
    }

    return new ChapterCanon(characters, locations);
  }

  private static JsonNode firstArray(JsonNode node, String... fields) {
    for (String field : fields) {
      JsonNode value = node.get(field);
      if (value != null && value.isArray()) return value;
    }
    return null;
  }

  private static List<String> parseStringList(JsonNode arr) {
    if (arr == null || !arr.isArray()) {
      return List.of();
    }
    List<String> result = new ArrayList<>();
    for (JsonNode item : arr) {
      if (item.isTextual() && !item.asText().isBlank()) {
        result.add(item.asText().trim());
      }
    }
    return result;
  }

  private static String text(JsonNode node, String field, String fallback) {
    JsonNode value = node.get(field);
    return value != null && value.isTextual() ? value.asText() : fallback;
  }
}
