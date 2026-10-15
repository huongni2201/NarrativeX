package com.narrativex.backend.feature.generation.application.model.prompt;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Strict wire/storage format for {@link PromptSettings}. Unknown or mistyped fields are rejected
 * instead of ignored so a client cannot silently lose configuration. Revision travels as a decimal
 * string because it is a BIGINT.
 */
public final class PromptSettingsJson {
  private static final Set<String> ROOT_FIELDS =
      Set.of(
          "formatVersion",
          "revision",
          "activeStyleId",
          "styles",
          "instructions",
          "videoNegativePrompt");
  private static final Set<String> STYLE_FIELDS =
      Set.of("id", "name", "positivePrompt", "negativePrompt", "characterRenderingPrompt");
  private static final Set<String> INSTRUCTION_FIELDS =
      Set.of("chapterAnalysis", "characterReference", "storyboard", "video");

  private PromptSettingsJson() {}

  public static PromptSettings parse(ObjectMapper mapper, String json) {
    if (json == null || json.isBlank()) {
      throw new DomainValidationException("settings: request body is required");
    }
    JsonNode root;
    try {
      root = mapper.readTree(json);
    } catch (RuntimeException exception) {
      throw new DomainValidationException("settings: malformed JSON", exception);
    }
    return parse(root);
  }

  public static PromptSettings parse(JsonNode root) {
    JsonNode object = requireObject("settings", root);
    rejectUnknown("settings", object, ROOT_FIELDS);
    JsonNode version = object.get("formatVersion");
    if (version == null || !version.isIntegralNumber() || !version.canConvertToInt()) {
      throw new DomainValidationException("formatVersion: must be an integer");
    }
    JsonNode stylesNode = object.get("styles");
    if (stylesNode == null || !stylesNode.isArray()) {
      throw new DomainValidationException("styles: must be an array");
    }
    List<PromptStyleProfile> styles = new ArrayList<>();
    int index = 0;
    for (JsonNode styleNode : stylesNode) {
      String path = "styles[" + index++ + "]";
      JsonNode style = requireObject(path, styleNode);
      rejectUnknown(path, style, STYLE_FIELDS);
      styles.add(
          new PromptStyleProfile(
              text(path + ".id", style, "id", true),
              text(path + ".name", style, "name", true),
              text(path + ".positivePrompt", style, "positivePrompt", true),
              text(path + ".negativePrompt", style, "negativePrompt", false),
              text(path + ".characterRenderingPrompt", style, "characterRenderingPrompt", false)));
    }
    JsonNode instructionsNode = requireObject("instructions", object.get("instructions"));
    rejectUnknown("instructions", instructionsNode, INSTRUCTION_FIELDS);
    PromptInstructions instructions =
        new PromptInstructions(
            text("instructions.chapterAnalysis", instructionsNode, "chapterAnalysis", false),
            text("instructions.characterReference", instructionsNode, "characterReference", false),
            text("instructions.storyboard", instructionsNode, "storyboard", false),
            text("instructions.video", instructionsNode, "video", false));
    return new PromptSettings(
        version.asInt(),
        revision(object.get("revision")),
        text("activeStyleId", object, "activeStyleId", true),
        styles,
        instructions,
        text("videoNegativePrompt", object, "videoNegativePrompt", false));
  }

  public static ObjectNode toJson(ObjectMapper mapper, PromptSettings settings) {
    ObjectNode root = mapper.createObjectNode();
    root.put("formatVersion", settings.formatVersion());
    root.put("revision", Long.toString(settings.revision()));
    root.put("activeStyleId", settings.activeStyleId());
    ArrayNode styles = root.putArray("styles");
    for (PromptStyleProfile style : settings.styles()) {
      ObjectNode node = styles.addObject();
      node.put("id", style.id());
      node.put("name", style.name());
      node.put("positivePrompt", style.positivePrompt());
      node.put("negativePrompt", style.negativePrompt());
      node.put("characterRenderingPrompt", style.characterRenderingPrompt());
    }
    ObjectNode instructions = root.putObject("instructions");
    instructions.put("chapterAnalysis", settings.instructions().chapterAnalysis());
    instructions.put("characterReference", settings.instructions().characterReference());
    instructions.put("storyboard", settings.instructions().storyboard());
    instructions.put("video", settings.instructions().video());
    root.put("videoNegativePrompt", settings.videoNegativePrompt());
    return root;
  }

  public static String toJsonString(ObjectMapper mapper, PromptSettings settings) {
    return mapper.writeValueAsString(toJson(mapper, settings));
  }

  private static long revision(JsonNode node) {
    if (node == null || node.isNull()) return 0L;
    if (!node.isTextual() || !node.asText().matches("[0-9]{1,18}")) {
      throw new DomainValidationException("revision: must be a decimal string");
    }
    return Long.parseLong(node.asText());
  }

  private static JsonNode requireObject(String path, JsonNode node) {
    if (node == null || !node.isObject()) {
      throw new DomainValidationException(path + ": must be an object");
    }
    return node;
  }

  private static void rejectUnknown(String path, JsonNode node, Set<String> allowed) {
    for (var field : node.properties()) {
      if (!allowed.contains(field.getKey())) {
        throw new DomainValidationException(path + ": unknown field " + field.getKey());
      }
    }
  }

  private static String text(String path, JsonNode parent, String field, boolean required) {
    JsonNode node = parent.get(field);
    if (node == null || node.isNull()) {
      if (required) throw new DomainValidationException(path + ": is required");
      return "";
    }
    if (!node.isTextual()) {
      throw new DomainValidationException(path + ": must be a string");
    }
    return node.asText();
  }
}
