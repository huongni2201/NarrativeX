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
  void manhuaProfileIsOwnedByBackend() {
    assertThat(ImageStyle.MANHUA.promptFor("A heroine enters a moonlit palace courtyard."))
        .contains("premium Chinese romantic-fantasy manhua illustration")
        .contains("SCENE DESCRIPTION: A heroine enters a moonlit palace courtyard.");
    assertThat(ImageStyle.MANHUA.negativePrompt())
        .contains("photorealistic photography", "watermark", "collage");
  }
}
