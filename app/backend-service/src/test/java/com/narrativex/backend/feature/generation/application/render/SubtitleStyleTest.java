package com.narrativex.backend.feature.generation.application.render;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class SubtitleStyleTest {
  private final JsonMapper json = JsonMapper.builder().build();

  @Test
  void snapshotsCustomStyleForBothAudioModes() {
    var style =
        new SubtitleStyle(
            2,
            "TOP_RIGHT",
            "OUTLINE",
            "Verdana",
            700,
            0.05,
            0.08,
            "#ffcc00",
            "#123456",
            "#000000",
            0.4);
    for (String mode : new String[] {"NATIVE_TAKE", "EXTERNAL_NARRATION"}) {
      var profile = json.readTree(ProjectRenderProfileFactory.create(24, true, false, mode, style));
      assertThat(profile.path("subtitles").path("style").path("position").asString())
          .isEqualTo("TOP_RIGHT");
      assertThat(profile.path("subtitles").path("style").path("primaryColor").asString())
          .isEqualTo("#FFCC00");
      assertThat(profile.path("subtitles").path("style").path("fontSizeRatio").asDouble())
          .isEqualTo(0.05);
      if (mode.equals("NATIVE_TAKE"))
        assertThat(profile.path("audioMode").asString()).isEqualTo(mode);
      else assertThat(profile.has("audioMode")).isFalse();
      assertThat(profile.path("schemaVersion").asInt())
          .isEqualTo(mode.equals("NATIVE_TAKE") ? 4 : 3);
    }
  }

  @Test
  void rejectsFontsThatCouldInjectStylesAndNonFiniteSizing() {
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                new SubtitleStyle(
                    2,
                    "TOP_LEFT",
                    "OUTLINE",
                    "Arial,Style:bad",
                    700,
                    0.05,
                    0.08,
                    "#FFFFFF",
                    "#000000",
                    "#000000",
                    0.75));
    assertThatIllegalArgumentException()
        .isThrownBy(
            () ->
                new SubtitleStyle(
                    2,
                    "TOP_LEFT",
                    "OUTLINE",
                    "Arial",
                    700,
                    Double.NaN,
                    0.08,
                    "#FFFFFF",
                    "#000000",
                    "#000000",
                    0.75));
    assertThatThrownBy(
            () ->
                json.readValue(
                    "{\"version\":2,\"position\":\"TOP_LEFT\",\"preset\":\"OUTLINE\",\"fontFamily\":\"Arial\",\"fontWeight\":700,\"fontSizeRatio\":0.05,\"edgeMarginRatio\":0.08,\"primaryColor\":\"red\",\"outlineColor\":\"#000000\",\"backgroundColor\":\"#000000\",\"backgroundOpacity\":0.75}",
                    SubtitleStyle.class))
        .hasRootCauseInstanceOf(IllegalArgumentException.class);
  }
}
