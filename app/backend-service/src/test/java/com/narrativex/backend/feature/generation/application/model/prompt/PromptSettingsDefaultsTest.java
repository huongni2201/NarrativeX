package com.narrativex.backend.feature.generation.application.model.prompt;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import org.junit.jupiter.api.Test;

class PromptSettingsDefaultsTest {
  private final PromptSettings defaults = PromptSettingsDefaults.settings();

  @Test
  void shipsTheThreeBuiltInStylesWithCinematicAnimeActive() {
    assertThat(defaults.styles())
        .extracting(PromptStyleProfile::id)
        .containsExactly("CINEMATIC_ANIME", "CINEMATIC", "STORYBOOK_WATERCOLOR");
    assertThat(defaults.activeStyleId()).isEqualTo("CINEMATIC_ANIME");
    assertThat(defaults.revision()).isZero();
    assertThat(defaults.formatVersion()).isEqualTo(PromptSettings.FORMAT_VERSION);
  }

  @Test
  void everyStyleHasUsableContent() {
    for (PromptStyleProfile style : defaults.styles()) {
      assertThat(style.name()).isNotBlank();
      assertThat(style.positivePrompt()).isNotBlank();
      assertThat(style.negativePrompt()).isNotBlank();
      assertThat(style.characterRenderingPrompt()).isNotBlank();
    }
    assertThat(defaults.instructions().chapterAnalysis()).isNotNull();
    assertThat(defaults.instructions().characterReference()).isNotBlank();
    assertThat(defaults.videoNegativePrompt()).contains("watermark");
  }

  @Test
  void cinematicAnimeKeepsThePremiumSemiRealisticCgiRendering() {
    PromptStyleProfile anime = defaults.style("CINEMATIC_ANIME").orElseThrow();

    assertThat(anime.positivePrompt())
        .contains("premium semi-realistic 3D CGI character rendering")
        .contains("70 percent realism and 30 percent anime-influenced stylization")
        .contains("almond-shaped expressive eyes")
        .contains("strand-level layered hair")
        .contains("soft subsurface skin scattering")
        .contains("creamy cinematic bokeh")
        .doesNotContain("champagne gold")
        .doesNotContain("romantic bloom");
    assertThat(anime.negativePrompt())
        .contains(
            "raw live-action photograph",
            "flat 2D cel anime",
            "waxy skin",
            "oversized eyes",
            "age regression",
            "face redesign",
            "multiple panels",
            "watermark");
  }

  @Test
  void otherStylesDoNotInheritTheAnimeThreeDLanguageOrNegatives() {
    String[] animeOnly = {
      "premium semi-realistic",
      "70 percent realism",
      "strand-level layered hair",
      "animated-feature CGI finish",
      "almond-shaped expressive eyes",
      "soft subsurface skin scattering"
    };
    for (String id : new String[] {"CINEMATIC", "STORYBOOK_WATERCOLOR"}) {
      PromptStyleProfile style = defaults.style(id).orElseThrow();
      assertThat(style.positivePrompt()).doesNotContain(animeOnly);
      assertThat(style.characterRenderingPrompt()).doesNotContain(animeOnly);
      assertThat(style.negativePrompt())
          .doesNotContain("flat 2D cel anime", "oversized eyes", "waxy skin");
    }
    assertThat(defaults.style("STORYBOOK_WATERCOLOR").orElseThrow().positivePrompt())
        .containsIgnoringCase("watercolor");
  }

  @Test
  void legacyStyleEnumMapsToTheMatchingBuiltInPreset() {
    for (ImageStyle style : ImageStyle.values()) {
      PromptSettings settings = PromptSettingsDefaults.settingsFor(style);
      assertThat(settings.activeStyleId()).isEqualTo(style.name());
      assertThat(PromptSettingsDefaults.preset(style).id()).isEqualTo(style.name());
    }
  }

  @Test
  void defaultsAreStableAcrossReads() {
    assertThat(PromptSettingsDefaults.settings().semanticHash()).isEqualTo(defaults.semanticHash());
    assertThat(defaults.semanticHash()).matches("[0-9a-f]{64}");
  }
}
