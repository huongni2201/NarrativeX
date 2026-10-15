package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Sole backend owner of compiled video generation prompts sent to video model adapters (e.g.
 * LTX-2.5). Compiles Subject + Action + Camera + Subject Motion + Camera Motion + Environment
 * Motion + Temporal Progression + Continuity Constraints + Shared Character Rendering Language.
 */
@Component
public final class VideoPromptCompiler {

  public record CompiledVideoPrompt(
      String prompt,
      String negativePrompt,
      String subjectDescription,
      String actionDescription,
      String cameraDescription,
      String motionDescription,
      String temporalProgression) {}

  private final ObjectMapper objectMapper;

  public VideoPromptCompiler(ObjectMapper objectMapper) {
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
  }

  /** Legacy preset-id overload; a null style compiles without any style rendering language. */
  public CompiledVideoPrompt compile(ShotView shot, ImageStyle style, String continuityContext) {
    return compile(
        shot, style == null ? null : PromptSettingsDefaults.settingsFor(style), continuityContext);
  }

  /**
   * Compiles from an already resolved configuration. A null configuration compiles the structural
   * prompt only, with no style, creative instruction or style negatives.
   */
  public CompiledVideoPrompt compile(
      ShotView shot, PromptSettings settings, String continuityContext) {
    Objects.requireNonNull(shot, "shot must not be null");

    String narrative = shot.narrativePurpose();
    String location = shot.locationRef() != null ? shot.locationRef() : "";

    String action = extractField(shot.actionJson(), "action");
    String startState = extractField(shot.startStateJson(), "state");
    String endState = extractField(shot.endStateJson(), "state");
    String composition = extractField(shot.compositionJson(), "composition");
    String camera = extractField(shot.cameraJson(), "camera");
    String subjectMotion = extractField(shot.subjectMotionJson(), "subjectMotion");
    String cameraMotion = extractField(shot.cameraMotionJson(), "cameraMotion");
    String environmentMotion = extractField(shot.environmentMotionJson(), "environmentMotion");

    List<String> characters = extractCharacters(shot.subjectsJson());

    // 1. Subject Section
    StringBuilder subjectSb = new StringBuilder();
    if (!characters.isEmpty()) {
      subjectSb.append("Characters: ").append(String.join(", ", characters));
    }
    if (!location.isBlank()) {
      if (!subjectSb.isEmpty()) subjectSb.append(" at ");
      subjectSb.append("Location: ").append(location);
    }
    String subjectDesc = subjectSb.toString();

    // 2. Action Section
    String actionDesc = !action.isBlank() ? action : narrative;

    // 3. Camera Section
    StringBuilder camSb = new StringBuilder();
    if (!composition.isBlank()) camSb.append(composition);
    if (!camera.isBlank()) {
      if (!camSb.isEmpty()) camSb.append(", ");
      camSb.append(camera);
    }
    String cameraDesc = camSb.toString();

    // 4. Motion Section
    StringBuilder motionSb = new StringBuilder();
    if (!subjectMotion.isBlank())
      motionSb.append("Subject motion: ").append(subjectMotion).append(". ");
    if (!cameraMotion.isBlank())
      motionSb.append("Camera movement: ").append(cameraMotion).append(". ");
    if (!environmentMotion.isBlank())
      motionSb.append("Atmosphere: ").append(environmentMotion).append(". ");
    String motionDesc = motionSb.toString().trim();

    // 5. Temporal Progression Section
    StringBuilder temporalSb = new StringBuilder();
    if (!startState.isBlank() || !endState.isBlank()) {
      temporalSb.append("Temporal progression: ");
      if (!startState.isBlank()) temporalSb.append("Starts with ").append(startState);
      if (!startState.isBlank() && !endState.isBlank()) temporalSb.append(", then transitions to ");
      if (!endState.isBlank()) temporalSb.append(endState);
      temporalSb.append(".");
    }
    String temporalDesc = temporalSb.toString();

    // Combine into final positive prompt
    StringBuilder promptSb = new StringBuilder();
    if (!actionDesc.isBlank()) promptSb.append(actionDesc).append(". ");
    if (!subjectDesc.isBlank()) promptSb.append(subjectDesc).append(". ");
    if (!cameraDesc.isBlank()) promptSb.append("Framing: ").append(cameraDesc).append(". ");
    if (!motionDesc.isBlank()) promptSb.append(motionDesc).append(" ");
    if (!temporalDesc.isBlank()) promptSb.append(temporalDesc).append(" ");

    if (continuityContext != null && !continuityContext.isBlank()) {
      promptSb.append("Continuity: ").append(continuityContext).append(". ");
    }

    String negativePrompt = "";
    if (settings != null) {
      String creativeDirection = settings.instructions().video();
      if (!creativeDirection.isBlank()) {
        promptSb.append("Direction: ").append(creativeDirection).append(' ');
      }
      SharedCharacterRenderingLanguage.appendTo(promptSb, settings.activeStyle());
      negativePrompt =
          mergeNegatives(settings.videoNegativePrompt(), settings.activeStyle().negativePrompt());
    }

    return new CompiledVideoPrompt(
        promptSb.toString().trim(),
        negativePrompt,
        subjectDesc,
        actionDesc,
        cameraDesc,
        motionDesc,
        temporalDesc);
  }

  /** Merges comma-separated negative lists, dropping case-insensitive duplicates in order. */
  static String mergeNegatives(String... lists) {
    Map<String, String> unique = new LinkedHashMap<>();
    for (String list : lists) {
      if (list == null) continue;
      for (String term : list.split(",")) {
        String trimmed = term.trim();
        if (!trimmed.isEmpty()) unique.putIfAbsent(trimmed.toLowerCase(Locale.ROOT), trimmed);
      }
    }
    return String.join(", ", unique.values());
  }

  private String extractField(String json, String fieldName) {
    if (json == null || json.isBlank() || json.equals("{}")) {
      return "";
    }
    try {
      JsonNode node = objectMapper.readTree(json);
      if (node.has(fieldName)) {
        return node.get(fieldName).asText("");
      }
    } catch (Exception ignored) {
    }
    return "";
  }

  private List<String> extractCharacters(String subjectsJson) {
    List<String> list = new ArrayList<>();
    if (subjectsJson == null || subjectsJson.isBlank() || subjectsJson.equals("[]")) {
      return list;
    }
    try {
      JsonNode node = objectMapper.readTree(subjectsJson);
      if (node.isArray()) {
        for (JsonNode item : node) {
          if (item.has("aiName")) {
            list.add(item.get("aiName").asText());
          } else if (item.isTextual()) {
            list.add(item.asText());
          }
        }
      }
    } catch (Exception ignored) {
    }
    return list;
  }
}
