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
  void cinematicAnimeProfileUsesPremiumManhwaCoverRendering() {
    String prompt =
        ImageStyle.CINEMATIC_ANIME.promptFor("A heroine stands in a moonlit abandoned house.");

    assertThat(prompt)
        .contains("premium modern manhwa and webnovel cover illustration")
        .contains("idealized protagonist design")
        .contains("sharp expressive eyes")
        .contains("layered iris detail")
        .contains("high-detail layered hair")
        .contains("fashion-forward wardrobe")
        .contains("strong subject-background separation")
        .contains("controlled rim lighting")
        .contains("rich high-contrast color design")
        .contains("main-character presence")
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
            "low-detail hair",
            "waxy skin",
            "age regression",
            "face redesign",
            "changing facial identity",
            "multiple panels",
            "watermark");
  }
}
