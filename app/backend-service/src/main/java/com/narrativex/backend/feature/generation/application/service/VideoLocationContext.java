package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.port.out.ShotLocationContextRepository.ShotLocationContext;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import tools.jackson.databind.json.JsonMapper;

/**
 * Deterministic Location text for one video Shot prompt. Every Shot of a Scene renders the same
 * {@link #settingText()}, so the Location is described once by the canon and never re-imagined per
 * Beat. The continuity sentence is derived from the preceding Shot of the same Scene.
 *
 * <p>Pure: the same {@link ShotLocationContext} always yields the same text and hash.
 */
public record VideoLocationContext(
    UUID locationId,
    String settingText,
    String specHash,
    UUID previousShotId,
    String continuityText) {

  /** Upper bound so the Location canon never drowns out the Shot action in the prompt. */
  static final int MAX_SETTING_CHARS = 600;

  private static final int MAX_PREVIOUS_STATE_CHARS = 300;
  private static final JsonMapper JSON = JsonMapper.builder().build();

  /** Returns null when the Shot's Scene has no usable Location. */
  public static VideoLocationContext from(ShotLocationContext context) {
    if (context == null || context.location() == null || context.location().locationId() == null) {
      return null;
    }
    String settingText = settingText(context.location());
    if (settingText.isBlank()) {
      return null;
    }
    return new VideoLocationContext(
        context.location().locationId(),
        settingText,
        sha256(settingText),
        context.previousShotId(),
        continuityText(context, settingNameOf(context)));
  }

  /** Identity recorded next to the Take so a later Location edit never rewrites history. */
  public Map<String, Object> provenance() {
    Map<String, Object> provenance = new TreeMap<>();
    provenance.put("locationId", locationId.toString());
    provenance.put("specHash", specHash);
    provenance.put("previousShotId", previousShotId == null ? null : previousShotId.toString());
    provenance.put("continuityHash", continuityText == null ? null : sha256(continuityText));
    return provenance;
  }

  private static String settingNameOf(ShotLocationContext context) {
    return normalize(context.location().name());
  }

  private static String settingText(LocationCanon location) {
    String name = normalize(location.name());
    String spec = normalize(location.visualPrompt());
    if (spec.isBlank()) {
      spec = normalize(location.description());
    }
    String text;
    if (name.isBlank()) {
      text = spec;
    } else if (spec.isBlank()) {
      text = name;
    } else {
      text = name + ": " + spec;
    }
    return truncateAtSentence(text, MAX_SETTING_CHARS);
  }

  private static String continuityText(ShotLocationContext context, String locationName) {
    if (context.previousShotId() == null) {
      return null;
    }
    StringBuilder text = new StringBuilder("same location");
    if (!locationName.isBlank()) {
      text.append(" (").append(locationName).append(')');
    }
    text.append(" as the previous shot, keep architecture, prop layout, lighting and time of day")
        .append(" unchanged");
    String previousEnd = previousEndState(context.previousEndStateJson());
    if (!previousEnd.isBlank()) {
      text.append("; previous shot ended with ").append(previousEnd);
    }
    return text.toString();
  }

  private static String previousEndState(String endStateJson) {
    if (endStateJson == null || endStateJson.isBlank() || endStateJson.equals("{}")) {
      return "";
    }
    try {
      var node = JSON.readTree(endStateJson);
      if (node.has("state")) {
        return truncateAtSentence(
            stripTrailingPeriod(normalize(node.get("state").asText(""))), MAX_PREVIOUS_STATE_CHARS);
      }
    } catch (Exception ignored) {
      // A malformed stored end state only removes the optional hint.
    }
    return "";
  }

  /** Collapses all whitespace, including newlines, so canon text cannot break prompt structure. */
  static String normalize(String value) {
    return value == null ? "" : value.replaceAll("\\s+", " ").trim();
  }

  static String stripTrailingPeriod(String value) {
    String result = value;
    while (result.endsWith(".")) {
      result = result.substring(0, result.length() - 1).stripTrailing();
    }
    return result;
  }

  /** Cuts on a sentence boundary when one exists inside the limit, otherwise on a word boundary. */
  static String truncateAtSentence(String text, int limit) {
    if (text.length() <= limit) {
      return text;
    }
    String head = text.substring(0, limit);
    int sentenceEnd =
        Math.max(head.lastIndexOf(". "), Math.max(head.lastIndexOf("! "), head.lastIndexOf("? ")));
    if (sentenceEnd > limit / 2) {
      return head.substring(0, sentenceEnd + 1);
    }
    int wordEnd = head.lastIndexOf(' ');
    return (wordEnd > limit / 2 ? head.substring(0, wordEnd) : head).stripTrailing();
  }

  private static String sha256(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}
