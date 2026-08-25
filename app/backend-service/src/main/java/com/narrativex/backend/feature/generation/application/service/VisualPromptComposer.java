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

/** Deterministically enriches one still-image prompt with immutable scene continuity context. */
@Component
public class VisualPromptComposer {
  static final int MAX_REFERENCE_IMAGES = 3;

  private final ObjectMapper objectMapper;

  public VisualPromptComposer(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public ComposedVisualPrompt compose(
      ImageStyle style, String visualIntent, VisualPromptContext context) {
    return compose(style, visualIntent, null, context);
  }

  public ComposedVisualPrompt compose(
      ImageStyle style, String visualIntent, String cameraAngle, VisualPromptContext context) {
    if (style == null) {
      throw new IllegalArgumentException("style must not be null");
    }
    if (visualIntent == null || visualIntent.isBlank()) {
      throw new IllegalArgumentException("visualIntent must not be blank");
    }
    VisualPromptContext safeContext = context == null ? VisualPromptContext.empty() : context;
    Set<UUID> selectedReferenceIds = selectReferenceIds(safeContext.characters());

    StringBuilder prompt = new StringBuilder(style.promptFor(visualIntent));
    appendCameraFraming(prompt, cameraAngle);
    appendLocation(prompt, safeContext.location());
    appendCharacters(prompt, safeContext.characters());
    if (!selectedReferenceIds.isEmpty()) {
      prompt.append(
          "\nREFERENCE IMAGE RULES: attached character images are identity references, not scene "
              + "compositions. Preserve face, hair, body proportions, and defining visual traits; "
              + "apply the requested scene, camera, pose, expression, wardrobe state, and lighting.");
    }
    prompt.append(
        "\nCONTINUITY RULES: preserve established identity, wardrobe, environment, spatial logic, "
            + "and lighting unless the scene description explicitly changes them. Do not invent "
            + "new characters, props, text, logos, or costume changes.");

    return new ComposedVisualPrompt(
        prompt.toString(),
        style.negativePrompt(),
        characterSnapshotJson(safeContext.characters(), selectedReferenceIds));
  }

  private static void appendCameraFraming(StringBuilder prompt, String cameraAngle) {
    if (cameraAngle == null || cameraAngle.isBlank()) {
      return;
    }
    String normalized = cameraAngle.trim().toUpperCase(Locale.ROOT);
    String instruction =
        switch (normalized) {
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
    prompt.append("\nCAMERA FRAMING: ").append(instruction).append('.');
  }

  private static Set<UUID> selectReferenceIds(List<CharacterCanon> characters) {
    LinkedHashSet<UUID> selected = new LinkedHashSet<>();
    if (characters == null || characters.isEmpty()) {
      return selected;
    }

    for (CharacterCanon character : characters) {
      sortedReferences(character).stream()
          .findFirst()
          .ifPresent(reference -> addReference(selected, reference));
      if (selected.size() == MAX_REFERENCE_IMAGES) {
        return selected;
      }
    }

    for (CharacterCanon character : characters) {
      for (CharacterReference reference : sortedReferences(character)) {
        addReference(selected, reference);
        if (selected.size() == MAX_REFERENCE_IMAGES) {
          return selected;
        }
      }
    }
    return selected;
  }

  private static List<CharacterReference> sortedReferences(CharacterCanon character) {
    return character.references().stream()
        .sorted(
            Comparator.comparingInt(CharacterReference::priority)
                .thenComparing(CharacterReference::assetId))
        .toList();
  }

  private static void addReference(Set<UUID> selected, CharacterReference reference) {
    if (reference != null && reference.assetId() != null) {
      selected.add(reference.assetId());
    }
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
    prompt
        .append("\nLOCATION CONTINUITY: ")
        .append(nonBlank(location.name(), "established location"));
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

  public record ComposedVisualPrompt(
      String prompt, String negativePrompt, String characterSnapshotJson) {}
}
