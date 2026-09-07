package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class VisualPromptAppearanceStateRegressionTest {
  private final VisualPromptComposer composer =
      new VisualPromptComposer(JsonMapper.builder().build());

  @Test
  void appearancePromptDoesNotHideStructuredWardrobeOrInjuryState() {
    var character =
        new CharacterCanon(
            UuidV7.random(),
            UuidV7.random(),
            "Minh",
            7,
            "lean young man, angular face, short black hair",
            "tired expression and pale skin",
            "late twenties",
            "short black hair",
            "bandage on left hand",
            "plain gray t-shirt",
            "PRIMARY",
            List.of());

    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Minh sits on the edge of the bed after waking.",
            new VisualPromptContext(null, List.of(character)));

    assertThat(result.prompt())
        .contains("CURRENT STATE")
        .contains("appearance: tired expression and pale skin")
        .contains("age: late twenties")
        .contains("hairstyle: short black hair")
        .contains("injury: bandage on left hand")
        .contains("wardrobe: plain gray t-shirt");
  }
}
