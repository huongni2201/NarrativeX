package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class VisualPromptComposerSinglePromptTest {
  private final VisualPromptComposer composer =
      new VisualPromptComposer(JsonMapper.builder().build());

  @Test
  void composesOneStructuredPromptWithoutLegacyWrapper() {
    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan discovers the hidden letter",
            direction("MEDIUM_CLOSE_UP", "LOW", 50),
            "RATIO_16_9",
            VisualPromptContext.empty());

    assertThat(result.prompt()).startsWith("TASK\n");
    assertThat(result.prompt()).contains("\n\nSTORY MOMENT\nLan discovers the hidden letter");
    assertThat(result.prompt()).contains("\n\nSHOT\nShot size: MEDIUM_CLOSE_UP");
    assertThat(result.prompt()).contains("Camera angle: LOW");
    assertThat(result.prompt()).contains("Lens and perspective: 50mm equivalent");
    assertThat(result.prompt()).contains("\n\nLIGHT AND COLOR\n");
    assertThat(result.prompt()).contains("\n\nSTYLE\n");
    assertThat(result.prompt()).contains("\n\nHARD CONSTRAINTS\n");
    assertThat(result.prompt()).doesNotContain("STYLE PROFILE:");
    assertThat(result.prompt()).doesNotContain("SCENE DIRECTION:");
    assertThat(result.prompt()).doesNotContain("VISUAL VARIETY:");
    assertThat(result.prompt().indexOf("STORY MOMENT"))
        .isLessThan(result.prompt().indexOf("STYLE\n"));
  }

  @Test
  void emitsCanonicalIdentityExactlyOnce() {
    var character =
        new CharacterCanon(
            UuidV7.random(),
            UuidV7.random(),
            "Lan",
            1,
            "oval face, dark eyes, shoulder-length black hair",
            "beige cardigan",
            "mid twenties",
            "shoulder-length black hair",
            null,
            "beige cardigan",
            "PRIMARY",
            List.of());

    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan waits beside the window",
            direction("MEDIUM", "EYE_LEVEL", 50),
            "16:9",
            new VisualPromptContext(null, List.of(character)));

    assertThat(result.prompt()).contains("CHARACTER LOCKS");
    assertThat(result.prompt()).contains("CURRENT STATE");
    assertThat(occurrences(result.prompt(), "oval face, dark eyes, shoulder-length black hair"))
        .isEqualTo(1);
  }

  @Test
  void wideShotsDoNotReceivePortraitOnlyNegativeConstraint() {
    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan crosses the open courtyard",
            direction("WIDE", "EYE_LEVEL", 35),
            "16:9",
            VisualPromptContext.empty());

    assertThat(result.negativePrompt()).doesNotContain("character too small in frame");
  }

  @Test
  void invalidStructuredDirectionFailsInsteadOfSilentlyFallingBack() {
    org.assertj.core.api.Assertions.assertThatThrownBy(
            () ->
                composer.compose(
                    ImageStyle.CINEMATIC,
                    "Lan reads the letter",
                    "{\"shot_size\":\"MEDIUM\"}",
                    "16:9",
                    VisualPromptContext.empty()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("visual direction");
  }

  private static String direction(String shotSize, String angle, int lensMm) {
    return """
        {"shot_size":"%s","camera_angle":"%s","lens_mm":%d,
         "focus_target":"Lan's reaction","action_phase":"REACTION",
         "subject_placement":"right third","foreground":"window frame",
         "background":"source-grounded room","motivated_light":"window daylight",
         "palette":"warm neutral","camera_movement":"PUSH_IN",
         "movement_direction":null,"movement_intensity":"SUBTLE",
         "crop_safe_area":"10 percent crop room"}
        """
        .formatted(shotSize, angle, lensMm);
  }

  private static int occurrences(String text, String needle) {
    int count = 0;
    int cursor = 0;
    while ((cursor = text.indexOf(needle, cursor)) >= 0) {
      count++;
      cursor += needle.length();
    }
    return count;
  }
}
