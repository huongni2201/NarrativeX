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

    List<String> appearance = new ArrayList<>();
    addLabeled(appearance, "CURRENT APPEARANCE", appearancePrompt);
    addLabeled(appearance, "AGE STATE", ageState);
    addLabeled(appearance, "HAIRSTYLE STATE", hairstyle);
    addLabeled(appearance, "INJURY / MARKINGS", injury);

    StringBuilder prompt = new StringBuilder("GLOBAL VISUAL STYLE: ").append(style.promptSuffix());
    prompt
        .append("\nCHARACTER IDENTITY REFERENCE TASK")
        .append(
            "\nGenerate exactly one canonical identity reference for the established character below as a premium semi-realistic 3D CGI character portrait, not a flat illustration and not a raw live-action photograph.")
        .append("\nCHARACTER: ")
        .append(canonicalName.trim())
        .append("\nIDENTITY LOCK: ")
        .append(visualPrompt.trim());
    for (String detail : appearance) {
      prompt.append('\n').append(detail);
    }
    SharedCharacterRenderingLanguage.appendTo(prompt, style);
    prompt.append(
        "\nREFERENCE COMPOSITION:"
            + "\n- exactly one character"
            + "\n- head and upper torso clearly visible, with enough shoulder and wardrobe silhouette to establish the design"
            + "\n- subtle confident or composed expression appropriate to the character; do not exaggerate emotion"
            + "\n- slight three-quarter angle unless a front view is more useful for identity readability"
            + "\n- face unobstructed and both eyes clearly readable"
            + "\n- sharp readable eyes with luminous iris detail and crisp catchlights"
            + "\n- strand-level layered hair with fine flyaways, natural volume, a stable silhouette and restrained edge highlights"
            + "\n- character styling that preserves the specified wardrobe and canon instead of inventing accessories or redesigning it"
            + "\n- clean softly defocused environmental background with subtle depth and atmosphere, never a blank passport-photo backdrop"
            + "\n- soft cinematic lighting with a diffused key, gentle fill, subtle rim light, and natural skin-tone rendering"
            + "\n- shallow depth of field and creamy bokeh using an 85mm portrait-lens look while keeping both eyes sharply readable"
            + "\n- polished animated-feature CGI finish with quiet main-character presence while keeping facial identity fully readable"
            + "\n- no dramatic story action and no unrelated props"
            + "\n- no text, captions, logos, watermarks, contact sheet, or second character"
            + "\nIDENTITY PRIORITY: facial geometry and recognizable silhouette are more important than dramatic composition."
            + "\nPURPOSE: this image becomes canonical identity evidence for later storyboard frames and should establish the same premium semi-realistic 3D CGI rendering language used by those frames."
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
