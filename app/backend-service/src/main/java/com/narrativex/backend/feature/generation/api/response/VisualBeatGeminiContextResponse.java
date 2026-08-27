package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Immutable continuity payload consumed by the Desktop Gemini Web adapter. */
public record VisualBeatGeminiContextResponse(
    UUID visualBeatId,
    String promptContext,
    List<CharacterItem> characters,
    List<ReferenceItem> references) {

  public VisualBeatGeminiContextResponse {
    characters = characters == null ? List.of() : List.copyOf(characters);
    references = references == null ? List.of() : List.copyOf(references);
  }

  public static VisualBeatGeminiContextResponse from(
      UUID visualBeatId,
      VisualPromptContext context,
      VisualPromptComposer composer) {
    var safeContext = context == null ? VisualPromptContext.empty() : context;
    var bindings = composer.referenceBindings(safeContext);
    var characters =
        safeContext.characters().stream()
            .map(
                character ->
                    new CharacterItem(
                        character.characterId(),
                        character.canonicalName(),
                        character.versionNumber(),
                        character.beatRole(),
                        character.visualPrompt(),
                        character.appearancePrompt(),
                        character.ageState(),
                        character.hairstyle(),
                        character.injury(),
                        character.wardrobeContext()))
            .toList();
    var references = new ArrayList<ReferenceItem>();
    for (int index = 0; index < bindings.size(); index++) {
      var binding = bindings.get(index);
      references.add(
          new ReferenceItem(
              String.format("REF_%02d", index + 1),
              binding.assetId(),
              binding.characterId(),
              binding.canonicalName(),
              binding.beatRole(),
              binding.referenceRole(),
              binding.priority(),
              binding.contentType(),
              binding.sha256()));
    }
    return new VisualBeatGeminiContextResponse(
        visualBeatId,
        compilePromptContext(safeContext.characters(), references),
        characters,
        references);
  }

  private static String compilePromptContext(
      List<CharacterCanon> characters, List<ReferenceItem> references) {
    if (characters.isEmpty()) {
      return "CHARACTER CONTINUITY: No established character is visible in this Visual Beat. Do not invent one.";
    }

    StringBuilder prompt =
        new StringBuilder(
            "CHARACTER CONTINUITY — only the following established characters are visible in this Visual Beat:");
    for (CharacterCanon character : characters) {
      prompt.append("\n- ").append(nonBlank(character.canonicalName(), "established character"));
      if (character.beatRole() != null && !character.beatRole().isBlank()) {
        prompt.append(" [").append(character.beatRole()).append(']');
      }
      List<String> details = new ArrayList<>();
      add(details, character.visualPrompt());
      add(details, character.appearancePrompt());
      addLabeled(details, "age state", character.ageState());
      addLabeled(details, "hairstyle", character.hairstyle());
      addLabeled(details, "injury", character.injury());
      addLabeled(details, "wardrobe", character.wardrobeContext());
      if (!details.isEmpty()) prompt.append(": ").append(String.join("; ", details));
    }

    if (!references.isEmpty()) {
      prompt.append(
          "\nREFERENCE IMAGE MAP — attachments are uploaded in exactly this order and are identity references, not scene compositions:");
      for (ReferenceItem reference : references) {
        prompt
            .append("\n- ")
            .append(reference.refLabel())
            .append(" = ")
            .append(nonBlank(reference.canonicalName(), "established character"));
        if (reference.beatRole() != null && !reference.beatRole().isBlank()) {
          prompt.append(" [").append(reference.beatRole()).append(']');
        }
        if (reference.referenceRole() != null && !reference.referenceRole().isBlank()) {
          prompt.append("; reference role=").append(reference.referenceRole());
        }
      }
      prompt.append(
          "\nIDENTITY RULE: preserve each mapped face, hair, age, body proportions, and defining traits. Never merge, swap, or transfer identities between REF labels. If a character has multiple references, they all describe the same identity.");
    } else {
      prompt.append(
          "\nREFERENCE AVAILABILITY: no locked reference image is available for these visible characters; preserve the textual canon exactly and do not redesign them.");
    }
    return prompt.toString();
  }

  private static void add(List<String> values, String value) {
    if (value != null && !value.isBlank()) values.add(value.trim());
  }

  private static void addLabeled(List<String> values, String label, String value) {
    if (value != null && !value.isBlank()) values.add(label + ": " + value.trim());
  }

  private static String nonBlank(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value.trim();
  }

  public record CharacterItem(
      UUID characterId,
      String canonicalName,
      Integer versionNumber,
      String beatRole,
      String visualPrompt,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext) {}

  public record ReferenceItem(
      String refLabel,
      UUID assetId,
      UUID characterId,
      String canonicalName,
      String beatRole,
      String referenceRole,
      int priority,
      String contentType,
      String sha256) {}
}
