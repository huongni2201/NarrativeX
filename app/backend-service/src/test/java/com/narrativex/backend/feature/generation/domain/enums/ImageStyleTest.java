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
  void cinematicAnimeProfileUsesSemiRealisticRomanceRendering() {
    assertThat(ImageStyle.CINEMATIC_ANIME.promptFor("A heroine stands in a sunlit flower field."))
        .contains("2.5D digital painting")
        .contains("romantic webnovel cover art")
        .contains("modern manhwa")
        .contains("champagne gold rim lighting")
        .contains("silky")
        .contains("scene only")
        .contains("SCENE DESCRIPTION: A heroine stands in a sunlit flower field.");

    assertThat(ImageStyle.CINEMATIC_ANIME.negativePrompt())
        .contains(
            "raw live-action photograph",
            "flat 2D cel anime",
            "plastic toy look",
            "multiple panels",
            "title",
            "watermark");
  }
}
