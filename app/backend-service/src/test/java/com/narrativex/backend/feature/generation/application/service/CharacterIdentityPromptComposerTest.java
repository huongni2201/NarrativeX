package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import org.junit.jupiter.api.Test;

class CharacterIdentityPromptComposerTest {

  private final CharacterIdentityPromptComposer composer = new CharacterIdentityPromptComposer();

  @Test
  void composesNeutralCharacterIdentityReferenceWithoutNarrativeBibleBias() {
    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan",
            "oval face, dark expressive eyes, shoulder-length black hair",
            "Reserved protagonist who lost her family in a fire",
            "beige cardigan and white blouse",
            "mid twenties",
            "straight shoulder-length black hair",
            "small scar above left eyebrow");

    String finalPrompt = VisualPromptText.finalPrompt(result.prompt(), result.negativePrompt());

    assertThat(finalPrompt)
        .startsWith("GLOBAL VISUAL STYLE: " + ImageStyle.CINEMATIC_ANIME.promptSuffix())
        .contains("CHARACTER IDENTITY REFERENCE TASK")
        .contains("CHARACTER: Lan")
        .contains("IDENTITY LOCK: oval face, dark expressive eyes, shoulder-length black hair")
        .contains("CURRENT APPEARANCE: beige cardigan and white blouse")
        .contains("AGE STATE: mid twenties")
        .contains("HAIRSTYLE STATE: straight shoulder-length black hair")
        .contains("INJURY / MARKINGS: small scar above left eyebrow")
        .contains("balanced soft frontal lighting")
        .contains("facial geometry and recognizable silhouette")
        .doesNotContain("Reserved protagonist")
        .doesNotContain("lost her family")
        .endsWith("AVOID: " + ImageStyle.CINEMATIC_ANIME.negativePrompt());
  }
}
