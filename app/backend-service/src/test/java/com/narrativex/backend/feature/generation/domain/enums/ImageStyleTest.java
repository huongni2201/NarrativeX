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
  void cinematicAnimeProfileUsesSceneAdaptiveRenderingWithoutRomanceBias() {
    String prompt =
        ImageStyle.CINEMATIC_ANIME.promptFor("A heroine stands in a moonlit abandoned house.");

    assertThat(prompt)
        .contains("2.5D digital painting")
        .contains("modern manhwa")
        .contains("age-appropriate facial structure")
        .contains("physically motivated lighting")
        .contains("consistent face geometry")
        .contains("adapted to the scene mood")
        .doesNotContain("champagne gold")
        .doesNotContain("romantic bloom")
        .contains("SCENE DESCRIPTION: A heroine stands in a moonlit abandoned house.");

    assertThat(ImageStyle.CINEMATIC_ANIME.negativePrompt())
        .contains(
            "raw live-action photograph",
            "flat 2D cel anime",
            "age regression",
            "face redesign",
            "changing facial identity",
            "multiple panels",
            "watermark");
  }
}
