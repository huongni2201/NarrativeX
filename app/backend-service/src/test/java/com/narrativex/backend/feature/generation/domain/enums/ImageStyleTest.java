package com.narrativex.backend.feature.generation.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ImageStyleTest {
  @Test
  void missingStyleDefaultsToCinematic() {
    assertThat(ImageStyle.from(null)).isEqualTo(ImageStyle.CINEMATIC);
    assertThat(ImageStyle.from(" ")).isEqualTo(ImageStyle.CINEMATIC);
  }

  @Test
  void promptProfileAddsStyleAndSceneContext() {
    assertThat(ImageStyle.CINEMATIC.promptFor("A woman enters a dark room."))
        .startsWith("GLOBAL VISUAL STYLE: cinematic visual storytelling")
        .contains("SCENE DESCRIPTION: A woman enters a dark room.");
  }

  @Test
  void cinematicAnimeProfileUsesPremiumSemiRealisticCgiRendering() {
    String prompt =
        ImageStyle.CINEMATIC_ANIME.promptFor("A heroine stands in a moonlit abandoned house.");

    assertThat(prompt)
        .contains("premium semi-realistic 3D CGI character rendering")
        .contains("70 percent realism and 30 percent anime-influenced stylization")
        .contains("idealized but believable character design")
        .contains("almond-shaped expressive eyes")
        .contains("layered iris detail")
        .contains("strand-level layered hair")
        .contains("soft subsurface skin scattering")
        .contains("subtle rim light")
        .contains("restrained filmic color grading")
        .contains("creamy cinematic bokeh")
        .contains("consistent face geometry")
        .doesNotContain("champagne gold")
        .doesNotContain("romantic bloom")
        .contains("SCENE DESCRIPTION: A heroine stands in a moonlit abandoned house.");

    assertThat(ImageStyle.CINEMATIC_ANIME.negativePrompt())
        .contains(
            "raw live-action photograph",
            "plain realistic portrait",
            "ordinary office portrait",
            "generic stock illustration",
            "flat 2D cel anime",
            "2.5D painterly illustration",
            "low-detail hair",
            "waxy skin",
            "oversized eyes",
            "age regression",
            "face redesign",
            "changing facial identity",
            "multiple panels",
            "watermark");
  }
}
