package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class VisualPromptComposerV3Test {
  private final VisualPromptComposerV3 composer =
      new VisualPromptComposerV3(JsonMapper.builder().build());

  private static final String DIRECTION =
      "{\"shot_size\":\"MEDIUM_CLOSE_UP\",\"camera_angle\":\"LOW\",\"lens_mm\":50,"
          + "\"focus_target\":\"Lan's hand gripping the letter\",\"action_phase\":\"AFTER\","
          + "\"subject_placement\":\"Lan on left third\",\"foreground\":\"desk edge\","
          + "\"background\":\"old apartment kitchen\",\"motivated_light\":\"window light from left\","
          + "\"palette\":\"desaturated blue with warm practical accents\",\"camera_movement\":\"PUSH_IN\","
          + "\"movement_direction\":null,\"movement_intensity\":\"SUBTLE\","
          + "\"crop_safe_area\":\"above and right\"}";

  @Test
  void ordersStoryAndShotBeforeStyle() {
    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan steadies the letter after the impact",
            DIRECTION,
            "RATIO_16_9",
            VisualPromptContext.empty());

    String prompt = result.prompt();
    assertThat(prompt).startsWith("TASK\n");
    assertThat(prompt.indexOf("STORY MOMENT\n")).isLessThan(prompt.indexOf("SHOT\n"));
    assertThat(prompt.indexOf("SHOT\n")).isLessThan(prompt.indexOf("STYLE\n"));
    assertThat(prompt)
        .contains("Shot size: MEDIUM_CLOSE_UP")
        .contains("Camera angle: LOW")
        .contains("Lens and perspective: 50mm equivalent")
        .contains("Focus target: Lan's hand gripping the letter")
        .contains("Action phase: AFTER")
        .contains("Motion-safe area: above and right");
  }

  @Test
  void emitsCanonicalIdentityOnceAndKeepsCurrentStateSeparate() {
    var character =
        new CharacterCanon(
            UuidV7.random(),
            UuidV7.random(),
            "Lan",
            1,
            "oval face, dark eyes, shoulder-length black hair",
            "beige cardigan and white blouse",
            "mid twenties",
            "straight shoulder-length black hair",
            null,
            "beige cardigan",
            "PRIMARY",
            List.of());
    var context =
        new VisualPromptContext(
            new LocationCanon(UuidV7.random(), "Kitchen", "old kitchen", "dark walnut kitchen"),
            List.of(character));

    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan reads the warning",
            DIRECTION,
            "RATIO_16_9",
            context);

    assertThat(result.prompt())
        .contains("CHARACTER LOCKS\n- Lan [PRIMARY]: oval face, dark eyes, shoulder-length black hair")
        .contains("CURRENT STATE\n- Lan: beige cardigan and white blouse")
        .contains("ENVIRONMENT\nKitchen — dark walnut kitchen")
        .doesNotContain("STORYBOARD CHARACTER QUALITY RULES")
        .doesNotContain("VISUAL VARIETY: avoid repetitive centered framing");
    assertThat(count(result.prompt(), "oval face, dark eyes, shoulder-length black hair")).isEqualTo(1);
  }

  @Test
  void wideShotDoesNotReceivePortraitOnlyNegativeConstraint() {
    String wide = DIRECTION.replace("MEDIUM_CLOSE_UP", "WIDE");
    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan crosses the courtyard",
            wide,
            "RATIO_16_9",
            VisualPromptContext.empty());

    assertThat(result.negativePrompt()).doesNotContain("character too small in frame");
  }

  private static int count(String text, String needle) {
    int count = 0;
    int cursor = 0;
    while ((cursor = text.indexOf(needle, cursor)) >= 0) {
      count++;
      cursor += needle.length();
    }
    return count;
  }
}
