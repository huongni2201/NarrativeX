package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ReferenceBinding;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Backend-owned Prompt V3 compiler. Desktop/provider adapters must submit its output verbatim. */
@Component
public final class VisualPromptComposerV3 {
  private final ObjectMapper objectMapper;
  private final VisualPromptComposer metadataComposer;

  public VisualPromptComposerV3(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
    this.metadataComposer = new VisualPromptComposer(objectMapper);
  }

  public ComposedVisualPrompt compose(
      ImageStyle style,
      String visualIntent,
      String visualDirectionJson,
      String aspectRatio,
      VisualPromptContext context) {
    if (style == null) throw new IllegalArgumentException("style must not be null");
    if (visualIntent == null || visualIntent.isBlank()) {
      throw new IllegalArgumentException("visualIntent must not be blank");
    }
    VisualPromptContext safeContext = context == null ? VisualPromptContext.empty() : context;
    Direction direction = parseDirection(visualDirectionJson);
    String ratio = normalizeRatio(aspectRatio);

    // Reuse deterministic reference selection and snapshot serialization, never its legacy prompt text.
    ComposedVisualPrompt metadata = metadataComposer.compose(style, visualIntent, safeContext);
    StringBuilder prompt = new StringBuilder();
    appendTask(prompt, ratio);
    prompt.append("\n\nSTORY MOMENT\n").append(visualIntent.trim());
    appendShot(prompt, direction);
    appendCharacterLocks(prompt, safeContext.characters());
    appendCurrentState(prompt, safeContext.characters());
    appendEnvironment(prompt, safeContext.location(), direction);
    appendLightAndColor(prompt, direction);
    appendReferences(prompt, metadata.referenceBindings());
    prompt.append("\n\nSTYLE\n").append(styleLanguage(style));
    appendHardConstraints(prompt);

    return new ComposedVisualPrompt(
        prompt.toString(),
        shotAwareNegativePrompt(style, direction.shotSize()),
        metadata.characterSnapshotJson(),
        metadata.referenceBindings());
  }

  private Direction parseDirection(String json) {
    if (json == null || json.isBlank()) {
      return Direction.safeDefault();
    }
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> values = objectMapper.readValue(json, Map.class);
      return new Direction(
          required(values, "shot_size"),
          required(values, "camera_angle"),
          integer(values, "lens_mm"),
          required(values, "focus_target"),
          required(values, "action_phase"),
          required(values, "subject_placement"),
          optional(values, "foreground"),
          required(values, "background"),
          required(values, "motivated_light"),
          required(values, "palette"),
          required(values, "camera_movement"),
          optional(values, "movement_direction"),
          required(values, "movement_intensity"),
          required(values, "crop_safe_area"));
    } catch (Exception exception) {
      throw new IllegalArgumentException("visualDirectionJson is not valid VisualDirectionV3", exception);
    }
  }

  private static void appendTask(StringBuilder prompt, String ratio) {
    prompt
        .append("TASK\nCreate one ")
        .append(ratio)
        .append(" narrative storyboard frame.\n")
        .append("No text, captions, speech bubbles, UI, borders, panels, signatures or watermark.");
  }

  private static void appendShot(StringBuilder prompt, Direction direction) {
    prompt
        .append("\n\nSHOT")
        .append("\nShot size: ").append(direction.shotSize())
        .append("\nCamera angle: ").append(direction.cameraAngle())
        .append("\nLens and perspective: ").append(direction.lensMm()).append("mm equivalent")
        .append("\nFocus target: ").append(direction.focusTarget())
        .append("\nSubject placement: ").append(direction.subjectPlacement());
    if (direction.foreground() != null) {
      prompt.append("\nForeground: ").append(direction.foreground());
    }
    prompt
        .append("\nBackground: ").append(direction.background())
        .append("\nAction phase: ").append(direction.actionPhase())
        .append("\nCamera movement: ").append(direction.cameraMovement());
    if (direction.movementDirection() != null) {
      prompt.append(" ").append(direction.movementDirection());
    }
    prompt
        .append(" (").append(direction.movementIntensity().toLowerCase(Locale.ROOT)).append(")")
        .append("\nMotion-safe area: ").append(direction.cropSafeArea());
  }

  private static void appendCharacterLocks(StringBuilder prompt, List<CharacterCanon> characters) {
    if (characters == null || characters.isEmpty()) return;
    prompt.append("\n\nCHARACTER LOCKS");
    for (CharacterCanon character : characters) {
      prompt.append("\n- ").append(nonBlank(character.canonicalName(), "established character"));
      if (hasText(character.beatRole())) prompt.append(" [").append(character.beatRole()).append(']');
      if (hasText(character.visualPrompt())) prompt.append(": ").append(character.visualPrompt().trim());
    }
  }

  private static void appendCurrentState(StringBuilder prompt, List<CharacterCanon> characters) {
    if (characters == null || characters.isEmpty()) return;
    List<String> rows = new ArrayList<>();
    for (CharacterCanon character : characters) {
      String state = currentState(character);
      if (state != null) rows.add("- " + nonBlank(character.canonicalName(), "character") + ": " + state);
    }
    if (rows.isEmpty()) return;
    prompt.append("\n\nCURRENT STATE");
    rows.forEach(row -> prompt.append("\n").append(row));
  }

  private static String currentState(CharacterCanon character) {
    if (hasText(character.appearancePrompt())) return character.appearancePrompt().trim();
    List<String> values = new ArrayList<>();
    add(values, "age", character.ageState());
    add(values, "hairstyle", character.hairstyle());
    add(values, "injury", character.injury());
    add(values, "wardrobe", character.wardrobeContext());
    return values.isEmpty() ? null : String.join("; ", values);
  }

  private static void appendEnvironment(
      StringBuilder prompt, LocationCanon location, Direction direction) {
    prompt.append("\n\nENVIRONMENT");
    if (location != null) {
      prompt.append("\n").append(nonBlank(location.name(), "established location"));
      String canon = hasText(location.visualPrompt()) ? location.visualPrompt().trim() : trim(location.description());
      if (canon != null) prompt.append(" — ").append(canon);
    }
    if (hasText(direction.background())) {
      prompt.append("\nBeat state: ").append(direction.background());
    }
  }

  private static void appendLightAndColor(StringBuilder prompt, Direction direction) {
    prompt
        .append("\n\nLIGHT AND COLOR")
        .append("\nMotivated light source: ").append(direction.motivatedLight())
        .append("\nScene palette: ").append(direction.palette());
  }

  private static void appendReferences(StringBuilder prompt, List<ReferenceBinding> references) {
    if (references == null || references.isEmpty()) return;
    prompt.append("\n\nREFERENCE MAP");
    for (int index = 0; index < references.size(); index++) {
      ReferenceBinding binding = references.get(index);
      prompt
          .append("\n- REF_")
          .append(String.format(Locale.ROOT, "%02d", index + 1))
          .append(" = ")
          .append(nonBlank(binding.canonicalName(), "established character"));
      if (hasText(binding.beatRole())) prompt.append(" [").append(binding.beatRole()).append(']');
      if (hasText(binding.referenceRole())) prompt.append("; role=").append(binding.referenceRole());
    }
    prompt.append("\nReferences are identity evidence only; do not copy their pose, crop, background or lighting.");
  }

  private static String styleLanguage(ImageStyle style) {
    return switch (style) {
      case CINEMATIC_ANIME ->
          "Polished cinematic manhwa illustration, expressive proportional faces, clean anatomy, coherent perspective, layered depth, readable silhouettes, detailed environment, refined hair and fabric rendering.";
      case CINEMATIC ->
          "Grounded cinematic film-still rendering, coherent perspective, natural texture, motivated lighting, layered depth and restrained color grading.";
      case STORYBOOK_WATERCOLOR ->
          "Cohesive storybook watercolor illustration, expressive silhouettes, soft edges, gentle paper texture, readable depth and scene-grounded lighting.";
    };
  }

  private static void appendHardConstraints(StringBuilder prompt) {
    prompt.append(
        "\n\nHARD CONSTRAINTS"
            + "\nPreserve each named character's identity, apparent age, face structure, hair and current wardrobe."
            + "\nPreserve location identity, prop ownership and spatial logic unless STORY MOMENT explicitly changes them."
            + "\nDo not add undeclared foreground characters."
            + "\nNo duplicated people or limbs."
            + "\nOne full-bleed frame only; no montage, collage, split screen or multiple panels.");
  }

  private static String shotAwareNegativePrompt(ImageStyle style, String shotSize) {
    List<String> removed = new ArrayList<>();
    if ("WIDE".equals(shotSize) || "ESTABLISHING".equals(shotSize)) {
      removed.add("character too small in frame");
      removed.add("empty background with no story context");
    }
    return Arrays.stream(style.negativePrompt().split(",\\s*"))
        .map(String::trim)
        .filter(value -> !removed.contains(value))
        .distinct()
        .reduce((left, right) -> left + ", " + right)
        .orElse("");
  }

  private static String normalizeRatio(String ratio) {
    if (ratio == null || ratio.isBlank()) return "16:9";
    String value = ratio.trim();
    return value.startsWith("RATIO_") ? value.substring(6).replace('_', ':') : value;
  }

  private static String required(Map<String, Object> values, String key) {
    String value = optional(values, key);
    if (value == null) throw new IllegalArgumentException("missing visual direction field " + key);
    return value;
  }

  private static String optional(Map<String, Object> values, String key) {
    Object value = values.get(key);
    return value == null || value.toString().isBlank() ? null : value.toString().trim();
  }

  private static int integer(Map<String, Object> values, String key) {
    Object value = values.get(key);
    if (value instanceof Number number) return number.intValue();
    return Integer.parseInt(required(values, key));
  }

  private static void add(List<String> values, String label, String value) {
    if (hasText(value)) values.add(label + ": " + value.trim());
  }

  private static String trim(String value) {
    return hasText(value) ? value.trim() : null;
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static String nonBlank(String value, String fallback) {
    return hasText(value) ? value.trim() : fallback;
  }

  private record Direction(
      String shotSize,
      String cameraAngle,
      int lensMm,
      String focusTarget,
      String actionPhase,
      String subjectPlacement,
      String foreground,
      String background,
      String motivatedLight,
      String palette,
      String cameraMovement,
      String movementDirection,
      String movementIntensity,
      String cropSafeArea) {
    static Direction safeDefault() {
      return new Direction(
          "MEDIUM",
          "EYE_LEVEL",
          50,
          "primary story subject",
          "AFTER",
          "balanced middle-third composition",
          null,
          "source-grounded environment",
          "source-grounded motivated light",
          "scene-appropriate restrained palette",
          "NONE",
          null,
          "SUBTLE",
          "modest crop room on all sides");
    }
  }
}
