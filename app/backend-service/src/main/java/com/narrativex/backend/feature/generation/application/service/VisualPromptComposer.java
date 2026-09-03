package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Sole backend owner of the exact still-image prompt sent to image providers.
 *
 * <p>Story semantics and structured shot direction are authored upstream. This composer only
 * combines them with canonical continuity, references and the selected rendering language. Desktop
 * and provider adapters must submit this output verbatim rather than wrapping or re-authoring it.
 */
@Component
public final class VisualPromptComposer {
  static final int MAX_REFERENCE_IMAGES = 3;

  private final ObjectMapper objectMapper;

  public VisualPromptComposer(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /** Compatibility overload for beats created before structured direction was persisted. */
  public ComposedVisualPrompt compose(
      ImageStyle style, String visualIntent, VisualPromptContext context) {
    return compose(style, visualIntent, null, null, context);
  }

  /**
   * Compatibility overload retained for callers that only have an aspect-independent beat.
   * The third argument is structured visual-direction JSON, never a legacy camera-angle prompt.
   */
  public ComposedVisualPrompt compose(
      ImageStyle style, String visualIntent, String visualDirectionJson, VisualPromptContext context) {
    return compose(style, visualIntent, visualDirectionJson, null, context);
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
    List<SelectedReference> selectedReferences = selectReferences(safeContext.characters());
    Set<UUID> selectedReferenceIds =
        selectedReferences.stream()
            .map(selected -> selected.reference().assetId())
            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

    StringBuilder prompt = new StringBuilder();
    appendTask(prompt, ratio);
    prompt.append("\n\nSTORY MOMENT\n").append(visualIntent.trim());
    appendShot(prompt, direction);
    appendCharacterLocks(prompt, safeContext.characters());
    appendCurrentState(prompt, safeContext.characters());
    appendEnvironment(prompt, safeContext.location(), direction);
    appendLightAndColor(prompt, direction);
    appendReferenceMap(prompt, selectedReferences);
    prompt.append("\n\nSTYLE\n").append(styleLanguage(style));
    appendHardConstraints(prompt);

    return new ComposedVisualPrompt(
        prompt.toString(),
        shotAwareNegativePrompt(style, direction.shotSize()),
        characterSnapshotJson(safeContext.characters(), selectedReferenceIds),
        selectedReferences.stream().map(SelectedReference::toBinding).toList());
  }

  public List<ReferenceBinding> referenceBindings(VisualPromptContext context) {
    VisualPromptContext safeContext = context == null ? VisualPromptContext.empty() : context;
    return selectReferences(safeContext.characters()).stream()
        .map(SelectedReference::toBinding)
        .toList();
  }

  private Direction parseDirection(String json) {
    if (json == null || json.isBlank()) return Direction.safeDefault();
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
      throw new IllegalArgumentException("visual direction JSON is invalid", exception);
    }
  }

  private static void appendTask(StringBuilder prompt, String ratio) {
    prompt
        .append("TASK\nCreate exactly one coherent ")
        .append(ratio)
        .append(" narrative storyboard frame.\n")
        .append("Full bleed only. No text, captions, speech bubbles, UI, borders, panels, signatures, logos or watermarks.");
  }

  private static void appendShot(StringBuilder prompt, Direction direction) {
    prompt
        .append("\n\nSHOT")
        .append("\nShot size: ").append(direction.shotSize())
        .append("\nCamera angle: ").append(direction.cameraAngle())
        .append("\nLens and perspective: ").append(direction.lensMm()).append("mm equivalent")
        .append("\nFocus target: ").append(direction.focusTarget())
        .append("\nSubject placement: ").append(direction.subjectPlacement());
    if (direction.foreground() != null) prompt.append("\nForeground: ").append(direction.foreground());
    prompt
        .append("\nBackground: ").append(direction.background())
        .append("\nAction phase: ").append(direction.actionPhase())
        .append("\nCamera movement: ").append(direction.cameraMovement());
    if (direction.movementDirection() != null) prompt.append(' ').append(direction.movementDirection());
    prompt
        .append(" (").append(direction.movementIntensity().toLowerCase(Locale.ROOT)).append(')')
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
      if (state != null) {
        rows.add("- " + nonBlank(character.canonicalName(), "character") + ": " + state);
      }
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
      String canon =
          hasText(location.visualPrompt()) ? location.visualPrompt().trim() : trim(location.description());
      if (canon != null) prompt.append(" — ").append(canon);
    }
    prompt.append("\nBeat state: ").append(direction.background());
  }

  private static void appendLightAndColor(StringBuilder prompt, Direction direction) {
    prompt
        .append("\n\nLIGHT AND COLOR")
        .append("\nMotivated light source: ").append(direction.motivatedLight())
        .append("\nScene palette: ").append(direction.palette());
  }

  private static void appendReferenceMap(
      StringBuilder prompt, List<SelectedReference> references) {
    if (references.isEmpty()) return;
    prompt.append("\n\nREFERENCE MAP");
    for (int index = 0; index < references.size(); index++) {
      SelectedReference selected = references.get(index);
      prompt
          .append("\n- REF_")
          .append(String.format(Locale.ROOT, "%02d", index + 1))
          .append(" = ")
          .append(nonBlank(selected.character().canonicalName(), "established character"));
      if (hasText(selected.character().beatRole())) {
        prompt.append(" [").append(selected.character().beatRole()).append(']');
      }
      if (hasText(selected.reference().role())) {
        prompt.append("; role=").append(selected.reference().role());
      }
    }
    prompt.append(
        "\nReferences are authoritative identity evidence only. Preserve facial geometry, age, proportions, hair silhouette, skin tone and permanent traits; do not copy reference pose, crop, background, expression or lighting unless STORY MOMENT explicitly requires it.");
  }

  private static String styleLanguage(ImageStyle style) {
    return switch (style) {
      case CINEMATIC_ANIME ->
          "Polished cinematic manhwa and webnovel illustration with proportional expressive faces, refined facial planes, detailed layered hair, clean anatomy, coherent perspective, painterly skin and fabric shading, cinematic depth, readable silhouettes and a premium commercial finish. Preserve canon rather than redesigning identity.";
      case CINEMATIC ->
          "Grounded cinematic film-still rendering with coherent perspective, natural texture, motivated lighting, layered depth and restrained filmic color grading.";
      case STORYBOOK_WATERCOLOR ->
          "Cohesive storybook watercolor illustration with expressive silhouettes, soft edges, gentle paper texture, readable spatial depth and scene-grounded lighting.";
    };
  }

  private static void appendHardConstraints(StringBuilder prompt) {
    prompt.append(
        "\n\nHARD CONSTRAINTS"
            + "\nPreserve each named character's identity, apparent age, face structure, hair and current wardrobe."
            + "\nPreserve established location identity, prop ownership, time-of-day and spatial logic unless STORY MOMENT explicitly changes them."
            + "\nDo not invent undeclared foreground characters, props, costume changes or story facts."
            + "\nNo duplicated people, faces or limbs; keep anatomy coherent."
            + "\nOne full-bleed frame only; no montage, collage, split screen, contact sheet or multiple panels.");
  }

  private static String shotAwareNegativePrompt(ImageStyle style, String shotSize) {
    Set<String> removed = new LinkedHashSet<>();
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

  private static List<SelectedReference> selectReferences(List<CharacterCanon> characters) {
    List<SelectedReference> selected = new ArrayList<>();
    Set<UUID> selectedIds = new LinkedHashSet<>();
    if (characters == null || characters.isEmpty()) return selected;

    for (CharacterCanon character : characters) {
      sortedReferences(character).stream()
          .filter(reference -> reference.assetId() != null && selectedIds.add(reference.assetId()))
          .findFirst()
          .ifPresent(reference -> selected.add(new SelectedReference(character, reference)));
      if (selected.size() == MAX_REFERENCE_IMAGES) return List.copyOf(selected);
    }
    for (CharacterCanon character : characters) {
      for (CharacterReference reference : sortedReferences(character)) {
        if (reference.assetId() != null && selectedIds.add(reference.assetId())) {
          selected.add(new SelectedReference(character, reference));
        }
        if (selected.size() == MAX_REFERENCE_IMAGES) return List.copyOf(selected);
      }
    }
    return List.copyOf(selected);
  }

  private static List<CharacterReference> sortedReferences(CharacterCanon character) {
    return character.references().stream()
        .sorted(
            Comparator.comparingInt(
                    (CharacterReference reference) -> referenceRoleRank(reference.role()))
                .thenComparingInt(CharacterReference::priority)
                .thenComparing(CharacterReference::assetId))
        .toList();
  }

  private static int referenceRoleRank(String role) {
    if (role == null || role.isBlank()) return 100;
    return switch (role.trim().toUpperCase(Locale.ROOT)) {
      case "IDENTITY" -> 0;
      case "FRONT" -> 1;
      case "PROFILE" -> 2;
      case "EXPRESSION" -> 3;
      case "OUTFIT" -> 4;
      default -> 10;
    };
  }

  private String characterSnapshotJson(
      List<CharacterCanon> characters, Set<UUID> selectedReferenceIds) {
    List<CharacterSnapshot> snapshots =
        (characters == null ? List.<CharacterCanon>of() : characters).stream()
            .map(
                character ->
                    new CharacterSnapshot(
                        character.assignmentId(),
                        character.characterId(),
                        character.canonicalName(),
                        character.versionNumber(),
                        character.visualPrompt(),
                        character.appearancePrompt(),
                        character.ageState(),
                        character.hairstyle(),
                        character.injury(),
                        character.wardrobeContext(),
                        character.beatRole(),
                        sortedReferences(character).stream()
                            .filter(reference -> selectedReferenceIds.contains(reference.assetId()))
                            .map(ReferenceSnapshot::from)
                            .toList()))
            .toList();
    try {
      return objectMapper.writeValueAsString(new CharacterSnapshotEnvelope(snapshots));
    } catch (Exception exception) {
      throw new IllegalStateException("Could not serialize character generation snapshot", exception);
    }
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

  private record SelectedReference(CharacterCanon character, CharacterReference reference) {
    ReferenceBinding toBinding() {
      return new ReferenceBinding(
          reference.assetId(),
          character.characterId(),
          character.canonicalName(),
          character.beatRole(),
          reference.role(),
          reference.priority(),
          reference.contentType(),
          reference.sha256());
    }
  }

  private record CharacterSnapshotEnvelope(List<CharacterSnapshot> characters) {}

  private record CharacterSnapshot(
      UUID assignmentId,
      UUID characterId,
      String canonicalName,
      Integer versionNumber,
      String visualPrompt,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String beatRole,
      List<ReferenceSnapshot> references) {}

  private record ReferenceSnapshot(
      UUID assetId,
      String role,
      int priority,
      String storageKey,
      String contentType,
      String sha256) {
    static ReferenceSnapshot from(CharacterReference reference) {
      return new ReferenceSnapshot(
          reference.assetId(),
          reference.role(),
          reference.priority(),
          reference.storageKey(),
          reference.contentType(),
          reference.sha256());
    }
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

  public record ReferenceBinding(
      UUID assetId,
      UUID characterId,
      String canonicalName,
      String beatRole,
      String referenceRole,
      int priority,
      String contentType,
      String sha256) {}

  public record ComposedVisualPrompt(
      String prompt,
      String negativePrompt,
      String characterSnapshotJson,
      List<ReferenceBinding> referenceBindings) {
    public ComposedVisualPrompt {
      referenceBindings = referenceBindings == null ? List.of() : List.copyOf(referenceBindings);
    }
  }
}
