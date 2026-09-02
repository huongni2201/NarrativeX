package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Deterministically compiles one still-image prompt from canonical continuity and beat-local
 * direction.
 */
@Component
public class VisualPromptComposer {
  static final int MAX_REFERENCE_IMAGES = 3;

  private final ObjectMapper objectMapper;

  public VisualPromptComposer(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public ComposedVisualPrompt compose(
      ImageStyle style, String visualIntent, VisualPromptContext context) {
    return compose(style, visualIntent, null, null, context);
  }

  public ComposedVisualPrompt compose(
      ImageStyle style, String visualIntent, String cameraAngle, VisualPromptContext context) {
    return compose(style, visualIntent, cameraAngle, null, context);
  }

  public ComposedVisualPrompt compose(
      ImageStyle style,
      String visualIntent,
      String cameraAngle,
      String aspectRatio,
      VisualPromptContext context) {
    if (style == null) throw new IllegalArgumentException("style must not be null");
    if (visualIntent == null || visualIntent.isBlank()) {
      throw new IllegalArgumentException("visualIntent must not be blank");
    }

    VisualPromptContext safeContext = context == null ? VisualPromptContext.empty() : context;
    List<SelectedReference> selectedReferences = selectReferences(safeContext.characters());
    Set<UUID> selectedReferenceIds =
        selectedReferences.stream()
            .map(selected -> selected.reference().assetId())
            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    String normalizedRatio = normalizeRatio(aspectRatio);

    StringBuilder prompt = new StringBuilder();
    prompt.append("STYLE PROFILE: ").append(style.promptSuffix());
    SharedCharacterRenderingLanguage.appendTo(prompt, style);
    prompt
        .append(
            "\nIMAGE TASK: Generate exactly one coherent still frame for one storyboard visual beat with a ")
        .append(normalizedRatio)
        .append(" aspect ratio.");
    prompt.append("\nSCENE DIRECTION: ").append(visualIntent.trim());
    appendStoryboardCharacterQualityRules(prompt, style);
    appendAspectRatio(prompt, normalizedRatio);
    appendCameraFraming(prompt, cameraAngle);
    appendLocation(prompt, safeContext.location());
    appendCharacterIdentityLocks(prompt, safeContext.characters());
    appendCurrentAppearance(prompt, safeContext.characters());
    appendReferenceMap(prompt, selectedReferences);
    appendConsistencyPrecedence(prompt);
    prompt
        .append("\nCOMPOSITION RULES: create one single ")
        .append(normalizedRatio)
        .append(
            " frame only. Full bleed composition without black letterbox bars or borders. Do not create a montage, collage, split screen, contact sheet, or multiple panels.");
    prompt.append(
        "\nVISUAL VARIETY: avoid repetitive centered framing. Use the requested camera framing as a deliberate shot variation; when neighboring beats are wide, prefer a tighter or detail-oriented composition unless the story explicitly requires another wide shot.");
    prompt.append(
        "\nCONTINUITY RULES: preserve established identity, current appearance, environment, spatial logic, prop ownership, and time-of-day unless SCENE DIRECTION explicitly changes them. Do not invent new characters, props, text, logos, or costume changes.");

    return new ComposedVisualPrompt(
        prompt.toString(),
        style.negativePrompt(),
        characterSnapshotJson(safeContext.characters(), selectedReferenceIds),
        selectedReferences.stream().map(SelectedReference::toBinding).toList());
  }

  public List<ReferenceBinding> referenceBindings(VisualPromptContext context) {
    VisualPromptContext safeContext = context == null ? VisualPromptContext.empty() : context;
    return selectReferences(safeContext.characters()).stream()
        .map(SelectedReference::toBinding)
        .toList();
  }

  private static String normalizeRatio(String aspectRatio) {
    if (aspectRatio == null || aspectRatio.isBlank()) return "16:9";
    String trimmed = aspectRatio.trim();
    if (trimmed.startsWith("RATIO_")) trimmed = trimmed.substring(6).replace('_', ':');
    return trimmed;
  }

  private static void appendAspectRatio(StringBuilder prompt, String normalizedRatio) {
    String description =
        switch (normalizedRatio) {
          case "16:9" -> "16:9 horizontal widescreen format (16:9 aspect ratio)";
          case "9:16" -> "9:16 vertical full-screen portrait format (9:16 aspect ratio)";
          case "1:1" -> "1:1 square format (1:1 aspect ratio)";
          case "4:3" -> "4:3 standard landscape format (4:3 aspect ratio)";
          case "3:4" -> "3:4 vertical portrait format (3:4 aspect ratio)";
          default -> normalizedRatio + " format (" + normalizedRatio + " aspect ratio)";
        };
    prompt.append("\nASPECT RATIO: ").append(description).append('.');
  }

  private static void appendCameraFraming(StringBuilder prompt, String cameraAngle) {
    if (cameraAngle == null || cameraAngle.isBlank()) return;
    String instruction =
        switch (cameraAngle.trim().toUpperCase(Locale.ROOT)) {
          case "WIDE" -> "wide shot; establish subject and environment clearly";
          case "MEDIUM" -> "medium shot; balance subject performance with surrounding context";
          case "CLOSE_UP" -> "close-up; prioritize face, expression, or the key story detail";
          case "EXTREME_CLOSE_UP" ->
              "extreme close-up; isolate one critical facial or object detail";
          case "LOW_ANGLE" -> "low-angle view; camera below the subject looking upward";
          case "HIGH_ANGLE" -> "high-angle view; camera above the subject looking downward";
          case "OVER_THE_SHOULDER" ->
              "over-the-shoulder framing with a clear foreground shoulder anchor";
          case "POV" -> "first-person point-of-view from the story character's position";
          default -> throw new IllegalArgumentException("Unsupported cameraAngle: " + cameraAngle);
        };
    prompt.append("\nCAMERA: ").append(instruction).append('.');
  }

  private static void appendStoryboardCharacterQualityRules(
      StringBuilder prompt, ImageStyle style) {
    if (style != ImageStyle.CINEMATIC_ANIME) return;
    prompt.append(
        "\nSTORYBOARD CHARACTER QUALITY RULES:"
            + "\n- preserve the same premium manhwa character rendering language used by canonical character references"
            + "\n- this is a scene illustration, but any visible face must still look like polished commercial webnovel key art rather than generic anime"
            + "\n- keep subject readability strong even when the frame includes environment context"
            + "\n- if the scene is a close-up or medium shot, prioritize face readability, eye fidelity, hair structure, and expression nuance"
            + "\n- if the scene is a wide shot, keep identity consistent without flattening the character into a low-detail generic figure");
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

  private static void appendReferenceMap(StringBuilder prompt, List<SelectedReference> references) {
    if (references.isEmpty()) return;
    prompt.append("\nREFERENCE IMAGE MAP: attachments are supplied in exactly this order:");
    for (int index = 0; index < references.size(); index++) {
      SelectedReference selected = references.get(index);
      prompt
          .append("\n- REF_")
          .append(String.format(Locale.ROOT, "%02d", index + 1))
          .append(" = ")
          .append(nonBlank(selected.character().canonicalName(), "established character"));
      if (hasText(selected.character().beatRole()))
        prompt.append(" [").append(selected.character().beatRole()).append(']');
      if (hasText(selected.reference().role()))
        prompt.append("; reference role=").append(selected.reference().role());
    }
    prompt.append(
        "\nREFERENCE USAGE: use each reference as identity evidence for facial geometry, eye shape and proportion, hairline, layered hair strand structure, skin tone, age, body proportions, and permanent distinguishing traits. Do not copy its background, crop, pose, expression, or lighting unless SCENE DIRECTION explicitly requires them.");
    prompt.append(
        "\nFACE FIDELITY RULE: when a referenced character face is visible, preserve the reference-level maturity, eye proportion, facial construction, and hair silhouette rather than drifting into a generic anime face.");
    prompt.append(
        "\nREFERENCE IDENTITY RULES: each REF maps only to its named character. Never merge, swap, or transfer identities between references.");
  }

  private static void appendLocation(StringBuilder prompt, LocationCanon location) {
    if (location == null) return;
    String details =
        hasText(location.visualPrompt())
            ? location.visualPrompt().trim()
            : trimOrNull(location.description());
    prompt.append("\nLOCATION CANON: ").append(nonBlank(location.name(), "established location"));
    if (details != null) prompt.append(" — ").append(details);
  }

  private static void appendCharacterIdentityLocks(
      StringBuilder prompt, List<CharacterCanon> characters) {
    if (characters == null || characters.isEmpty()) return;
    prompt.append("\nCHARACTER IDENTITY LOCKS:");
    for (CharacterCanon character : characters) {
      prompt.append("\n- ").append(nonBlank(character.canonicalName(), "established character"));
      if (hasText(character.beatRole()))
        prompt.append(" [").append(character.beatRole()).append(']');
      if (hasText(character.visualPrompt()))
        prompt.append(": ").append(character.visualPrompt().trim());
    }
  }

  private static void appendCurrentAppearance(
      StringBuilder prompt, List<CharacterCanon> characters) {
    if (characters == null || characters.isEmpty()) return;
    List<String> rows = new ArrayList<>();
    for (CharacterCanon character : characters) {
      String appearance = currentAppearance(character);
      if (appearance != null)
        rows.add(
            "- "
                + nonBlank(character.canonicalName(), "established character")
                + ": "
                + appearance);
    }
    if (rows.isEmpty()) return;
    prompt.append("\nCURRENT APPEARANCE STATE:");
    for (String row : rows) prompt.append("\n").append(row);
  }

  private static String currentAppearance(CharacterCanon character) {
    if (hasText(character.appearancePrompt())) return character.appearancePrompt().trim();
    List<String> details = new ArrayList<>();
    addLabeled(details, "age", character.ageState());
    addLabeled(details, "hairstyle", character.hairstyle());
    addLabeled(details, "injury", character.injury());
    addLabeled(details, "wardrobe", character.wardrobeContext());
    return details.isEmpty() ? null : String.join("; ", details);
  }

  private static void appendConsistencyPrecedence(StringBuilder prompt) {
    prompt.append(
        "\nCONSISTENCY PRECEDENCE: reference images are authoritative for visible identity; CHARACTER IDENTITY LOCKS define permanent traits not clear in references; CURRENT APPEARANCE STATE defines temporary wardrobe, hairstyle state, age state, and injuries; CHARACTER RENDERING LANGUAGE controls face quality, eye proportion, hair structure, skin rendering, and premium manhwa finish when present; SCENE DIRECTION controls current pose, action, expression, camera, environment state, and lighting; STYLE PROFILE controls rendering language only and must never redesign identity.");
  }

  private String characterSnapshotJson(
      List<CharacterCanon> characters, Set<UUID> selectedReferenceIds) {
    List<CharacterSnapshot> snapshots =
        (characters == null ? List.<CharacterCanon>of() : characters)
            .stream()
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
                                .filter(
                                    reference -> selectedReferenceIds.contains(reference.assetId()))
                                .map(ReferenceSnapshot::from)
                                .toList()))
                .toList();
    try {
      return objectMapper.writeValueAsString(new CharacterSnapshotEnvelope(snapshots));
    } catch (Exception exception) {
      throw new IllegalStateException(
          "Could not serialize character generation snapshot", exception);
    }
  }

  private static void addLabeled(List<String> target, String label, String value) {
    if (hasText(value)) target.add(label + ": " + value.trim());
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static String trimOrNull(String value) {
    return hasText(value) ? value.trim() : null;
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
