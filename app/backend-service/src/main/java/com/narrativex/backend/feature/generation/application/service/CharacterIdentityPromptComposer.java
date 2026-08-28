package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/** Deterministically composes one canonical character-reference image prompt. */
@Component
public class CharacterIdentityPromptComposer {

  public ComposedCharacterPrompt compose(
      ImageStyle style,
      String canonicalName,
      String visualPrompt,
      String bible,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury) {
    if (style == null) {
      throw new IllegalArgumentException("style must not be null");
    }
    if (canonicalName == null || canonicalName.isBlank()) {
      throw new IllegalArgumentException("canonicalName must not be blank");
    }
    if (visualPrompt == null || visualPrompt.isBlank()) {
      throw new IllegalArgumentException("visualPrompt must not be blank");
    }

    List<String> details = new ArrayList<>();
    details.add("Canonical identity: " + visualPrompt.trim());
    addLabeled(details, "Appearance", appearancePrompt);
    addLabeled(details, "Age state", ageState);
    addLabeled(details, "Hairstyle", hairstyle);
    addLabeled(details, "Injury/markings", injury);

    StringBuilder prompt =
        new StringBuilder("GLOBAL VISUAL STYLE: ").append(style.promptSuffix());
    prompt
        .append("\nCHARACTER REFERENCE TASK")
        .append("\nGenerate exactly one canonical identity reference for the established character below.")
        .append("\nCharacter: ")
        .append(canonicalName.trim());
    for (String detail : details) {
      prompt.append('\n').append(detail);
    }
    if (bible != null && !bible.isBlank()) {
      prompt.append("\nCharacter bible context: ").append(bible.trim());
    }
    prompt.append(
        "\nREFERENCE COMPOSITION:"
            + "\n- one character only"
            + "\n- head and upper torso clearly visible"
            + "\n- neutral or subtle expression"
            + "\n- slight three-quarter angle"
            + "\n- face unobstructed and easy to recognize"
            + "\n- clean simple background"
            + "\n- no story action or unrelated props"
            + "\n- no text, captions, logos, watermarks, contact sheet, or second character"
            + "\nPURPOSE: this image becomes canonical identity evidence for later storyboard frames."
            + "\nPreserve specified traits exactly. Do not invent or redesign defining identity traits.");

    return new ComposedCharacterPrompt(prompt.toString(), style.negativePrompt());
  }

  private static void addLabeled(List<String> target, String label, String value) {
    if (value != null && !value.isBlank()) {
      target.add(label + ": " + value.trim());
    }
  }

  public record ComposedCharacterPrompt(String prompt, String negativePrompt) {}
}
