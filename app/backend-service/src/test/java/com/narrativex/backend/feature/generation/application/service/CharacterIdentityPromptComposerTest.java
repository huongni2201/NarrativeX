package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import org.junit.jupiter.api.Test;

class CharacterIdentityPromptComposerTest {

  private final CharacterIdentityPromptComposer composer = new CharacterIdentityPromptComposer();

  @Test
  void composesCharacterReferenceWithSameVisualStyleAndNegativePromptAsStoryboard() {
    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan",
            "oval face, dark expressive eyes, shoulder-length black hair",
            "Reserved but determined protagonist",
            "beige cardigan and white blouse",
            "mid twenties",
            "straight shoulder-length black hair",
            "small scar above left eyebrow");

    String finalPrompt = VisualPromptText.finalPrompt(result.prompt(), result.negativePrompt());

    assertThat(finalPrompt)
        .startsWith("GLOBAL VISUAL STYLE: " + ImageStyle.CINEMATIC_ANIME.promptSuffix())
        .contains("CHARACTER REFERENCE TASK")
        .contains("Character: Lan")
        .contains("Canonical identity: oval face, dark expressive eyes, shoulder-length black hair")
        .contains("Appearance: beige cardigan and white blouse")
        .contains("Age state: mid twenties")
        .contains("Hairstyle: straight shoulder-length black hair")
        .contains("Injury/markings: small scar above left eyebrow")
        .contains("Character bible context: Reserved but determined protagonist")
        .endsWith("AVOID: " + ImageStyle.CINEMATIC_ANIME.negativePrompt());
  }
}
