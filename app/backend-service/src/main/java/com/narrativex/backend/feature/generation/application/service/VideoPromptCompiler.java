package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
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
  private static final int MAX_VISIBLE_CHARACTERS = 8;
  private static final int MAX_CHARACTER_DETAIL_CHARS = 800;

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
    return compile(shot, settings, continuityContext, null);
  }

  /**
   * Compiles with the Scene's resolved Location. A non-null {@code locationContext} replaces the
   * free-text {@code locationRef} with the canonical Setting, identical for every Shot of the
   * Scene, and appends the same-Scene continuity sentence. A null context keeps the {@code
   * locationRef} fallback.
   */
  public CompiledVideoPrompt compile(
      ShotView shot,
      PromptSettings settings,
      String continuityContext,
      VideoLocationContext locationContext) {
    return compile(shot, settings, continuityContext, locationContext, null);
  }

  /** Compiles with the pinned canon of characters explicitly participating in this VisualBeat. */
  public CompiledVideoPrompt compile(
      ShotView shot,
      PromptSettings settings,
      String continuityContext,
      VideoLocationContext locationContext,
      List<CharacterCanon> characterContext) {
    Objects.requireNonNull(shot, "shot must not be null");

    String narrative = shot.narrativePurpose();
    String location =
        locationContext == null && shot.locationRef() != null ? shot.locationRef() : "";

    String action = extractField(shot.actionJson(), "action");
    String actionPhase = extractField(shot.actionJson(), "actionPhase");
    if (actionPhase.isBlank()) actionPhase = extractField(shot.actionJson(), "action_phase");
    String startState = extractField(shot.startStateJson(), "state");
    String endState = extractField(shot.endStateJson(), "state");
    String composition = extractField(shot.compositionJson(), "composition");
    String camera = extractField(shot.cameraJson(), "camera");
    String subjectMotion = extractField(shot.subjectMotionJson(), "subjectMotion");
    String cameraMotion = extractField(shot.cameraMotionJson(), "cameraMotion");
    String environmentMotion = extractField(shot.environmentMotionJson(), "environmentMotion");

    List<CharacterCanon> selectedCharacters =
        characterContext == null
            ? List.of()
            : selectVisibleCharacters(shot.subjectsJson(), characterContext);
    List<String> characters =
        selectedCharacters.isEmpty()
            ? extractCharacters(shot.subjectsJson())
            : selectedCharacters.stream().map(CharacterCanon::canonicalName).toList();

    // 1. Subject Section
    StringBuilder subjectSb = new StringBuilder();
    if (!characters.isEmpty()) {
      subjectSb.append("Characters: ").append(String.join(", ", characters));
    }
    if (!location.isBlank()) {
      if (!subjectSb.isEmpty()) {
        if (selectedCharacters.isEmpty()) subjectSb.append(" at ");
        else subjectSb.append('\n');
      }
      subjectSb.append("Location: ").append(location);
    }
    for (CharacterCanon character : selectedCharacters) {
      List<String> appearance = new ArrayList<>();
      addBounded(appearance, "visual profile", character.visualPrompt());
      addBounded(appearance, "appearance", character.appearancePrompt());
      addBounded(appearance, "age", character.ageState());
      addBounded(appearance, "hairstyle", character.hairstyle());
      addBounded(appearance, "injury", character.injury());
      addBounded(appearance, "wardrobe", character.wardrobeContext());
      subjectSb
          .append("\nCharacter identity lock: ")
          .append(bounded(character.canonicalName(), 120))
          .append(" [CharacterVersion ")
          .append(character.versionNumber())
          .append("]: ")
          .append(bounded(String.join("; ", appearance), MAX_CHARACTER_DETAIL_CHARS));
    }
    String subjectDesc = subjectSb.toString();

    // 2. Action Section
    String actionDesc = !action.isBlank() ? action : narrative;
    if (!actionPhase.isBlank()) {
      actionDesc =
          actionDesc.isBlank() ? actionPhase : actionDesc + " Action phase: " + actionPhase;
    }

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
    if (locationContext != null) {
      promptSb
          .append("Setting: ")
          .append(VideoLocationContext.stripTrailingPeriod(locationContext.settingText()))
          .append(". ");
    }
    if (!cameraDesc.isBlank()) promptSb.append("Framing: ").append(cameraDesc).append(". ");
    if (!motionDesc.isBlank()) promptSb.append(motionDesc).append(" ");
    if (!temporalDesc.isBlank()) promptSb.append(temporalDesc).append(" ");

    List<String> continuity = new ArrayList<>();
    if (continuityContext != null && !continuityContext.isBlank()) {
      continuity.add(continuityContext);
    }
    if (locationContext != null && locationContext.continuityText() != null) {
      continuity.add(locationContext.continuityText());
    }
    if (!continuity.isEmpty()) {
      promptSb.append("Continuity: ").append(String.join("; ", continuity)).append(". ");
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

  /**
   * Resolves shot subjects only against VisualBeat participants; speech-only characters stay out.
   */
  public List<CharacterCanon> selectVisibleCharacters(
      String subjectsJson, List<CharacterCanon> characterContext) {
    List<CharacterCanon> candidates =
        characterContext == null ? List.of() : List.copyOf(characterContext);
    List<List<String>> subjects = extractSubjectKeys(subjectsJson);
    if (subjects.isEmpty()) {
      if (candidates.size() > MAX_VISIBLE_CHARACTERS) {
        throw new DomainValidationException(
            "TOO_MANY_VISIBLE_CHARACTERS: a Shot supports at most "
                + MAX_VISIBLE_CHARACTERS
                + " visible character locks");
      }
      candidates.forEach(VideoPromptCompiler::requirePinnedCharacter);
      return candidates;
    }

    if (candidates.isEmpty()) {
      throw new DomainValidationException(
          "SHOT_SUBJECT_NOT_IN_VISUAL_BEAT: Shot subjects must participate in the VisualBeat");
    }

    List<CharacterCanon> selected = new ArrayList<>();
    for (List<String> subjectKeys : subjects) {
      CharacterCanon match = null;
      for (String key : subjectKeys) {
        List<CharacterCanon> matches =
            candidates.stream().filter(candidate -> matchesSubject(candidate, key)).toList();
        if (matches.size() != 1
            || (match != null && !match.assignmentId().equals(matches.getFirst().assignmentId()))) {
          throw new DomainValidationException(
              "SHOT_SUBJECT_NOT_IN_VISUAL_BEAT: Shot subject does not resolve to one participating character");
        }
        match = matches.getFirst();
      }
      if (match == null) {
        throw new DomainValidationException("SHOT_SUBJECT_MISSING_IDENTITY: Shot subject is empty");
      }
      requirePinnedCharacter(match);
      UUID assignmentId = match.assignmentId();
      if (selected.stream().noneMatch(character -> character.assignmentId().equals(assignmentId))) {
        selected.add(match);
      }
      if (selected.size() > MAX_VISIBLE_CHARACTERS) {
        throw new DomainValidationException(
            "TOO_MANY_VISIBLE_CHARACTERS: a Shot supports at most "
                + MAX_VISIBLE_CHARACTERS
                + " visible character locks");
      }
    }
    return List.copyOf(selected);
  }

  private List<List<String>> extractSubjectKeys(String subjectsJson) {
    if (subjectsJson == null || subjectsJson.isBlank() || subjectsJson.equals("[]"))
      return List.of();
    try {
      JsonNode node = objectMapper.readTree(subjectsJson);
      if (node == null || !node.isArray()) {
        throw new DomainValidationException("INVALID_SHOT_SUBJECTS: expected an array");
      }
      List<List<String>> subjects = new ArrayList<>();
      for (JsonNode item : node) {
        List<String> keys = new ArrayList<>();
        if (item.isTextual()) {
          addKey(keys, item.asText());
        } else if (item.isObject()) {
          for (String field :
              List.of("projectCharacterId", "characterId", "aiName", "canonicalName", "name")) {
            if (item.hasNonNull(field) && item.get(field).isTextual()) {
              addKey(keys, item.get(field).asText());
            }
          }
        } else {
          throw new DomainValidationException("INVALID_SHOT_SUBJECTS: expected names or objects");
        }
        if (keys.isEmpty()) {
          throw new DomainValidationException(
              "SHOT_SUBJECT_MISSING_IDENTITY: Shot subject is empty");
        }
        subjects.add(List.copyOf(keys));
      }
      return List.copyOf(subjects);
    } catch (DomainValidationException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new DomainValidationException("INVALID_SHOT_SUBJECTS: expected valid JSON");
    }
  }

  private static void addKey(List<String> keys, String value) {
    if (value != null && !value.isBlank()) keys.add(value.trim());
  }

  private static boolean matchesSubject(CharacterCanon candidate, String key) {
    String normalized = key.trim().toLowerCase(Locale.ROOT);
    return (candidate.assignmentId() != null
            && normalized.equals(candidate.assignmentId().toString()))
        || (candidate.characterId() != null
            && normalized.equals(candidate.characterId().toString()))
        || normalized.equals(normalize(candidate.aiName()))
        || normalized.equals(normalize(candidate.canonicalName()));
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private static void requirePinnedCharacter(CharacterCanon character) {
    if (character.assignmentId() == null
        || character.characterId() == null
        || character.characterVersionId() == null
        || character.canonicalName() == null
        || character.canonicalName().isBlank()
        || character.visualPrompt() == null
        || character.visualPrompt().isBlank()) {
      throw new DomainValidationException(
          "MISSING_CHARACTER_CANON_VERSION: visible character needs a pinned version and visual profile");
    }
  }

  private static void addBounded(List<String> target, String label, String value) {
    if (value != null && !value.isBlank()) {
      target.add(label + ": " + bounded(value, 200));
    }
  }

  private static String bounded(String value, int maxChars) {
    if (value == null) return "";
    String trimmed = value.trim();
    if (trimmed.length() <= maxChars) return trimmed;
    return trimmed.substring(0, maxChars - 1).trim() + "…";
  }
}
