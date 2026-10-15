package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import org.junit.jupiter.api.Test;

class CharacterIdentityPromptComposerTest {

  private final CharacterIdentityPromptComposer composer = new CharacterIdentityPromptComposer();
  private final PromptSettings settings =
      PromptSettingsDefaults.settingsFor(ImageStyle.CINEMATIC_ANIME);

  @Test
  void composesPremiumCharacterReferenceWithoutNarrativeBibleBias() {
    var result =
        composer.compose(
            settings,
            "Lan",
            "oval face, dark expressive eyes, shoulder-length black hair",
            "Reserved protagonist who lost her family in a fire",
            "beige cardigan and white blouse",
            "mid twenties",
            "straight shoulder-length black hair",
            "small scar above left eyebrow");

    String finalPrompt = VisualPromptText.finalPrompt(result.prompt(), result.negativePrompt());

    assertThat(finalPrompt)
        .startsWith("GLOBAL VISUAL STYLE: " + settings.activeStyle().positivePrompt())
        .contains("CHARACTER IDENTITY REFERENCE TASK")
        .contains("CHARACTER: Lan")
        .contains("IDENTITY LOCK: oval face, dark expressive eyes, shoulder-length black hair")
        .contains("CURRENT APPEARANCE: beige cardigan and white blouse")
        .contains("AGE STATE: mid twenties")
        .contains("HAIRSTYLE STATE: straight shoulder-length black hair")
        .contains("INJURY / MARKINGS: small scar above left eyebrow")
        .contains("CHARACTER RENDERING LANGUAGE:")
        .contains("FACE QUALITY PRIORITY:")
        .contains("ANTI-DRIFT:")
        .contains("proportional almond-shaped expressive eyes")
        .contains("do not enlarge the eyes")
        .contains("premium semi-realistic 3D CGI character portrait")
        .contains("strand-level layered hair")
        .contains("sharp readable eyes")
        .contains("85mm portrait-lens look")
        .contains("animated-feature CGI finish")
        .contains("facial geometry and recognizable silhouette")
        .doesNotContain("balanced soft frontal lighting")
        .doesNotContain("Reserved protagonist")
        .doesNotContain("lost her family")
        .endsWith("AVOID: " + settings.activeStyle().negativePrompt());
  }

  @Test
  void switchingTheSavedStyleChangesTheReferenceLookWithoutLeakingAnimeLanguage() {
    var watercolor =
        composer.compose(
            PromptSettingsDefaults.settings().withActiveStyle("STORYBOOK_WATERCOLOR"),
            "Lan",
            "oval face",
            null,
            null,
            null,
            null,
            null);

    String finalPrompt =
        VisualPromptText.finalPrompt(watercolor.prompt(), watercolor.negativePrompt());

    assertThat(finalPrompt)
        .containsIgnoringCase("watercolor")
        .contains("CHARACTER IDENTITY REFERENCE TASK")
        .contains("IDENTITY LOCK: oval face")
        .doesNotContain("premium semi-realistic 3D CGI")
        .doesNotContain("animated-feature CGI finish")
        .doesNotContain("flat 2D cel anime");
  }

  @Test
  void customReferenceInstructionIsAddedButProtectedLinesStayLast() {
    var base = PromptSettingsDefaults.settings();
    var custom =
        new PromptSettings(
            base.formatVersion(),
            base.revision(),
            base.activeStyleId(),
            base.styles(),
            new com.narrativex.backend.feature.generation.application.model.prompt
                .PromptInstructions(
                base.instructions().chapterAnalysis(),
                "- always show hands relaxed at the sides",
                base.instructions().storyboard(),
                base.instructions().video()),
            base.videoNegativePrompt());

    var result = composer.compose(custom, "Lan", "oval face", null, null, null, null, null);

    String prompt = result.prompt();
    assertThat(prompt)
        .contains("always show hands relaxed at the sides")
        .contains("IDENTITY LOCK: oval face");
    // Custom guidance sits inside the composition block; backend-owned protections follow it.
    assertThat(prompt.indexOf("always show hands relaxed at the sides"))
        .isGreaterThan(prompt.indexOf("- exactly one character"))
        .isLessThan(prompt.indexOf("- no text, captions, logos, watermarks"))
        .isLessThan(prompt.indexOf("IDENTITY PRIORITY:"))
        .isLessThan(prompt.indexOf("Preserve specified traits exactly."));
  }
}
