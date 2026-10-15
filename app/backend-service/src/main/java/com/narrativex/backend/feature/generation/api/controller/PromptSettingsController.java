package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewTarget;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsJson;
import com.narrativex.backend.feature.generation.application.usecase.PromptPreviewUseCase;
import com.narrativex.backend.feature.generation.application.usecase.PromptSettingsUseCase;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Settings → Prompt: the installation-wide prompt configuration shared by every Project. */
@RestController
@RequestMapping("/api/v1/settings/prompts")
@RequiredArgsConstructor
public class PromptSettingsController {
  private final PromptSettingsUseCase useCase;
  private final PromptPreviewUseCase previewUseCase;
  private final ObjectMapper objectMapper;

  @GetMapping
  public ApiResponse<ObjectNode> get() {
    return ApiResponse.success("Prompt settings", view(useCase.current()));
  }

  /** The body is the full configuration; its {@code revision} is the revision being edited. */
  @PutMapping
  public ApiResponse<ObjectNode> put(@RequestBody JsonNode body) {
    PromptSettings saved = useCase.save(PromptSettingsJson.parse(body));
    return ApiResponse.success("Prompt settings saved", view(saved));
  }

  /**
   * Compiles the prompts a new operation would freeze for one real project target. {@code settings}
   * is an optional unsaved draft; without it the saved configuration is previewed. Nothing is
   * written and no provider is called.
   */
  @PostMapping("/preview")
  public ApiResponse<ObjectNode> preview(@RequestBody JsonNode body) {
    rejectUnknown("request", body, Set.of("settings", "target"));
    JsonNode draftNode = body.get("settings");
    PromptSettings draft =
        draftNode == null || draftNode.isNull() ? null : PromptSettingsJson.parse(draftNode);
    PromptPreviewTarget target = parseTarget(body.get("target"));
    var preview = previewUseCase.preview(draft, target);

    ObjectNode data = objectMapper.createObjectNode();
    data.put("source", preview.draft() ? "DRAFT" : "SAVED");
    data.put("savedRevision", Long.toString(preview.savedRevision()));
    data.put("settingsRevision", Long.toString(preview.settings().revision()));
    data.put("styleId", preview.settings().activeStyleId());
    data.put("effectiveHash", preview.settings().effectiveHash());
    data.put("targetType", target.type());
    data.put("prompt", preview.result().prompt());
    data.put("negativePrompt", preview.result().negativePrompt());
    data.put("finalText", preview.result().finalText());
    return ApiResponse.success("Prompt preview", data);
  }

  private static PromptPreviewTarget parseTarget(JsonNode node) {
    if (node == null || !node.isObject()) {
      throw new DomainValidationException("target: must be an object");
    }
    String type = text(node, "type");
    return switch (type) {
      case "CHARACTER" -> {
        rejectUnknown("target", node, Set.of("type", "projectId", "characterId"));
        yield new PromptPreviewTarget.Character(uuid(node, "projectId"), uuid(node, "characterId"));
      }
      case "VISUAL_BEAT" -> {
        rejectUnknown("target", node, Set.of("type", "projectId", "chapterId", "visualBeatId"));
        yield new PromptPreviewTarget.VisualBeat(
            uuid(node, "projectId"), uuid(node, "chapterId"), uuid(node, "visualBeatId"));
      }
      case "SHOT" -> {
        rejectUnknown("target", node, Set.of("type", "projectId", "shotId"));
        yield new PromptPreviewTarget.Shot(uuid(node, "projectId"), uuid(node, "shotId"));
      }
      default -> throw new DomainValidationException("target.type: unsupported value");
    };
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.get(field);
    if (value == null || !value.isTextual() || value.asText().isBlank()) {
      throw new DomainValidationException("target." + field + ": is required");
    }
    return value.asText();
  }

  private static UUID uuid(JsonNode node, String field) {
    try {
      return UUID.fromString(text(node, field));
    } catch (IllegalArgumentException exception) {
      throw new DomainValidationException("target." + field + ": must be a UUID");
    }
  }

  private static void rejectUnknown(String path, JsonNode node, Set<String> allowed) {
    if (node == null || !node.isObject()) {
      throw new DomainValidationException(path + ": must be an object");
    }
    Iterator<String> names = node.propertyNames().iterator();
    while (names.hasNext()) {
      String name = names.next();
      if (!allowed.contains(name)) {
        throw new DomainValidationException(path + "." + name + ": unknown field");
      }
    }
  }

  private ObjectNode view(PromptSettings settings) {
    ObjectNode data = objectMapper.createObjectNode();
    data.set("settings", PromptSettingsJson.toJson(objectMapper, settings));
    data.put("effectiveHash", settings.effectiveHash());
    data.set("defaults", PromptSettingsJson.toJson(objectMapper, useCase.defaults()));
    return data;
  }
}
