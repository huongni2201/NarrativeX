package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.BeatContinuity;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class VisualPromptContinuityTest {
  private final VisualPromptComposer composer =
      new VisualPromptComposer(JsonMapper.builder().build());

  @Test
  void pinnedVisibleStateIsIncludedWithoutFutureExitStateLeakage() {
    BeatContinuity continuity =
        new BeatContinuity(
            UUID.fromString("00000000-0000-4000-8000-000000000010"),
            "present",
            "[{\"subjectKey\":\"sword\",\"predicate\":\"prop_position\",\"value\":\"table\",\"provenance\":\"SOURCE\"}]",
            "[{\"subjectKey\":\"scene\",\"predicate\":\"time_of_day\",\"value\":\"night\",\"provenance\":\"SOURCE\"}]",
            "[{\"subjectKey\":\"sword\",\"predicate\":\"prop_position\",\"value\":\"in_hand\",\"provenance\":\"SOURCE\"}]",
            "[]",
            "a".repeat(64));

    var prompt =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan looks at the sword on the table.",
            null,
            "16:9",
            new VisualPromptContext(null, List.of(), continuity));

    assertThat(prompt.prompt()).contains("PINNED CONTINUITY");
    assertThat(prompt.prompt()).contains("sword prop_position = table");
    assertThat(prompt.prompt()).contains("scene time_of_day = night");
    assertThat(prompt.prompt()).doesNotContain("in_hand");
  }

  @Test
  void legacyOrImportedBeatWithoutContinuityKeepsPromptValid() {
    var prompt =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "An empty street in the rain.",
            new VisualPromptContext(null, List.of()));

    assertThat(prompt.prompt()).doesNotContain("PINNED CONTINUITY");
    assertThat(prompt.prompt()).contains("STORY MOMENT");
  }
}
