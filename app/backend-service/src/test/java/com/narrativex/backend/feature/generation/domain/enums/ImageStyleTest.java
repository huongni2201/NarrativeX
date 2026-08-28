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
  void cinematicAnimeProfileIsOwnedByBackend() {
    assertThat(ImageStyle.CINEMATIC_ANIME.promptFor("A heroine stands in a sunlit flower field."))
        .contains("cinematic anime illustration")
        .contains("soft luminous atmospheric lighting")
        .contains("glossy eyes")
        .contains("wind-swept hair")
        .contains("SCENE DESCRIPTION: A heroine stands in a sunlit flower field.");
    assertThat(ImageStyle.CINEMATIC_ANIME.negativePrompt())
        .contains("photorealistic photography", "3D render", "multiple panels", "watermark");
  }
}
