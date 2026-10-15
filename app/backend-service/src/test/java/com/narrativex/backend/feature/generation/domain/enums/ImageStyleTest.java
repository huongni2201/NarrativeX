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
  void legacyIdsMapToTheirEnumConstants() {
    assertThat(ImageStyle.from("cinematic_anime")).isEqualTo(ImageStyle.CINEMATIC_ANIME);
    assertThat(ImageStyle.from("STORYBOOK_WATERCOLOR")).isEqualTo(ImageStyle.STORYBOOK_WATERCOLOR);
  }
}
