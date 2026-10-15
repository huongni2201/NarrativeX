package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/** Deterministically composes one canonical character-reference image prompt. */
@Component
public class CharacterIdentityPromptComposer {

  /** Legacy preset-id overload; resolves the built-in preset text from the defaults. */
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
    return compose(
        PromptSettingsDefaults.settingsFor(style),
        canonicalName,
        visualPrompt,
        bible,
        appearancePrompt,
        ageState,
        hairstyle,
        injury);
  }

  /** Composes from an already resolved configuration; never reads Prompt settings itself. */
  public ComposedCharacterPrompt compose(
      PromptSettings settings,
      String canonicalName,
      String visualPrompt,
      String bible,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury) {
    if (settings == null) {
      throw new IllegalArgumentException("settings must not be null");
    }
    var style = settings.activeStyle();
    if (canonicalName == null || canonicalName.isBlank()) {
      throw new IllegalArgumentException("canonicalName must not be blank");
    }
    if (visualPrompt == null || visualPrompt.isBlank()) {
      throw new IllegalArgumentException("visualPrompt must not be blank");
    }

    List<String> appearance = new ArrayList<>();
    addLabeled(appearance, "CURRENT APPEARANCE", appearancePrompt);
    addLabeled(appearance, "AGE STATE", ageState);
    addLabeled(appearance, "HAIRSTYLE STATE", hairstyle);
    addLabeled(appearance, "INJURY / MARKINGS", injury);

    StringBuilder prompt =
        new StringBuilder("GLOBAL VISUAL STYLE: ").append(style.positivePrompt());
    prompt
        .append("\nCHARACTER IDENTITY REFERENCE TASK")
        .append(
            "\nGenerate exactly one canonical identity reference for the established character below, rendered in the global visual style above and never as a raw photograph of a real person.")
        .append("\nCHARACTER: ")
        .append(canonicalName.trim())
        .append("\nIDENTITY LOCK: ")
        .append(visualPrompt.trim());
    for (String detail : appearance) {
      prompt.append('\n').append(detail);
    }
    SharedCharacterRenderingLanguage.appendTo(prompt, style);
    prompt.append("\nREFERENCE COMPOSITION:\n- exactly one character");
    String composition = settings.instructions().characterReference();
    if (!composition.isBlank()) {
      prompt.append('\n').append(composition);
    }
    prompt.append(
        "\n- no dramatic story action and no unrelated props"
            + "\n- no text, captions, logos, watermarks, contact sheet, or second character"
            + "\nIDENTITY PRIORITY: facial geometry and recognizable silhouette are more important than dramatic composition."
            + "\nPURPOSE: this image becomes canonical identity evidence for later storyboard frames and should establish the same rendering language used by those frames."
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
