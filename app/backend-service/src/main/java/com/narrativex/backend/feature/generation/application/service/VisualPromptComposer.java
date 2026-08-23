package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/** Deterministically enriches one still-image prompt with immutable scene continuity context. */
@Component
public class VisualPromptComposer {

  public ComposedVisualPrompt compose(
      ImageStyle style, String visualIntent, VisualPromptContext context) {
    if (style == null) {
      throw new IllegalArgumentException("style must not be null");
    }
    if (visualIntent == null || visualIntent.isBlank()) {
      throw new IllegalArgumentException("visualIntent must not be blank");
    }
    VisualPromptContext safeContext = context == null ? VisualPromptContext.empty() : context;

    StringBuilder prompt = new StringBuilder(style.promptFor(visualIntent));
    appendLocation(prompt, safeContext.location());
    appendCharacters(prompt, safeContext.characters());
    prompt.append(
        "\nCONTINUITY RULES: preserve established identity, wardrobe, environment, spatial logic, "
            + "and lighting unless the scene description explicitly changes them. Do not invent "
            + "new characters, props, text, logos, or costume changes.");

    return new ComposedVisualPrompt(
        prompt.toString(), style.negativePrompt(), characterSnapshotJson(safeContext.characters()));
  }

  private static void appendLocation(StringBuilder prompt, LocationCanon location) {
    if (location == null) {
      return;
    }
    List<String> details = new ArrayList<>();
    addIfPresent(details, location.visualPrompt());
    if (details.isEmpty()) {
      addIfPresent(details, location.description());
    }
    prompt.append("\nLOCATION CONTINUITY: ").append(nonBlank(location.name(), "established location"));
    if (!details.isEmpty()) {
      prompt.append(" — ").append(String.join("; ", details));
    }
  }

  private static void appendCharacters(StringBuilder prompt, List<CharacterCanon> characters) {
    if (characters == null || characters.isEmpty()) {
      return;
    }
    prompt.append("\nCHARACTER CONTINUITY — preserve these identities exactly:");
    for (CharacterCanon character : characters) {
      prompt.append("\n- ").append(nonBlank(character.canonicalName(), "established character"));
      List<String> details = new ArrayList<>();
      addIfPresent(details, character.visualPrompt());
      addIfPresent(details, character.appearancePrompt());
      addLabeled(details, "age state", character.ageState());
      addLabeled(details, "hairstyle", character.hairstyle());
      addLabeled(details, "injury", character.injury());
      addLabeled(details, "wardrobe", character.wardrobeContext());
      if (!details.isEmpty()) {
        prompt.append(": ").append(String.join("; ", details));
      }
    }
  }

  static String characterSnapshotJson(List<CharacterCanon> characters) {
    if (characters == null || characters.isEmpty()) {
      return "{\"characters\":[]}";
    }
    StringBuilder json = new StringBuilder("{\"characters\":[");
    for (int index = 0; index < characters.size(); index++) {
      if (index > 0) {
        json.append(',');
      }
      CharacterCanon character = characters.get(index);
      json.append('{');
      appendJsonNumber(json, "assignmentId", character.assignmentId());
      json.append(',');
      appendJsonNumber(json, "characterId", character.characterId());
      json.append(',');
      appendJsonString(json, "canonicalName", character.canonicalName());
      json.append(',');
      appendJsonNumber(json, "versionNumber", character.versionNumber());
      json.append(',');
      appendJsonString(json, "visualPrompt", character.visualPrompt());
      json.append(',');
      appendJsonString(json, "appearancePrompt", character.appearancePrompt());
      json.append(',');
      appendJsonString(json, "ageState", character.ageState());
      json.append(',');
      appendJsonString(json, "hairstyle", character.hairstyle());
      json.append(',');
      appendJsonString(json, "injury", character.injury());
      json.append(',');
      appendJsonString(json, "wardrobeContext", character.wardrobeContext());
      json.append('}');
    }
    return json.append("]}").toString();
  }

  private static void addIfPresent(List<String> target, String value) {
    if (value != null && !value.isBlank()) {
      target.add(value.trim());
    }
  }

  private static void addLabeled(List<String> target, String label, String value) {
    if (value != null && !value.isBlank()) {
      target.add(label + ": " + value.trim());
    }
  }

  private static String nonBlank(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value.trim();
  }

  private static void appendJsonString(StringBuilder json, String key, String value) {
    json.append('\"').append(key).append("\":");
    if (value == null) {
      json.append("null");
      return;
    }
    json.append('\"').append(escapeJson(value)).append('\"');
  }

  private static void appendJsonNumber(StringBuilder json, String key, Number value) {
    json.append('\"').append(key).append("\":");
    json.append(value == null ? "null" : value.toString());
  }

  private static String escapeJson(String value) {
    StringBuilder escaped = new StringBuilder(value.length() + 16);
    for (int index = 0; index < value.length(); index++) {
      char current = value.charAt(index);
      switch (current) {
        case '\\' -> escaped.append("\\\\");
        case '\"' -> escaped.append("\\\"");
        case '\b' -> escaped.append("\\b");
        case '\f' -> escaped.append("\\f");
        case '\n' -> escaped.append("\\n");
        case '\r' -> escaped.append("\\r");
        case '\t' -> escaped.append("\\t");
        default -> {
          if (current < 0x20) {
            escaped.append(String.format("\\u%04x", (int) current));
          } else {
            escaped.append(current);
          }
        }
      }
    }
    return escaped.toString();
  }

  public record ComposedVisualPrompt(
      String prompt, String negativePrompt, String characterSnapshotJson) {}
}
