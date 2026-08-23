package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.List;
import org.junit.jupiter.api.Test;

class VisualPromptComposerTest {

  private final VisualPromptComposer composer = new VisualPromptComposer();

  @Test
  void enrichesStillImagePromptWithStableCharacterAndLocationCanon() {
    var context =
        new VisualPromptContext(
            new LocationCanon(10L, "Kitchen", "old apartment kitchen", "warm practical lighting"),
            List.of(
                new CharacterCanon(
                    20L,
                    30L,
                    "Lan",
                    4,
                    "oval face, dark eyes, shoulder-length black hair",
                    "beige cardigan and white blouse",
                    "mid twenties",
                    "straight shoulder-length black hair",
                    null,
                    "beige cardigan")));

    var result = composer.compose(ImageStyle.CINEMATIC, "Lan opens the letter", context);

    assertThat(result.prompt())
        .contains("SCENE DESCRIPTION: Lan opens the letter")
        .contains("LOCATION CONTINUITY: Kitchen — warm practical lighting")
        .contains("CHARACTER CONTINUITY")
        .contains("oval face, dark eyes")
        .contains("wardrobe: beige cardigan")
        .contains("CONTINUITY RULES");
    assertThat(result.characterSnapshotJson())
        .contains("\"canonicalName\":\"Lan\"")
        .contains("\"versionNumber\":4");
  }

  @Test
  void keepsPromptExecutableWhenSceneHasNoCanonYet() {
    var result = composer.compose(ImageStyle.CINEMATIC, "Empty hallway at dawn", null);

    assertThat(result.prompt())
        .contains("SCENE DESCRIPTION: Empty hallway at dawn")
        .contains("CONTINUITY RULES")
        .doesNotContain("CHARACTER CONTINUITY")
        .doesNotContain("LOCATION CONTINUITY");
    assertThat(result.characterSnapshotJson()).isEqualTo("{\"characters\":[]}");
  }

  @Test
  void escapesCharacterSnapshotAsValidJsonText() {
    var context =
        new VisualPromptContext(
            null,
            List.of(
                new CharacterCanon(
                    1L,
                    2L,
                    "Lan \"L\"",
                    1,
                    "line one\nline two",
                    null,
                    null,
                    null,
                    null,
                    null)));

    var result = composer.compose(ImageStyle.CINEMATIC, "Portrait", context);

    assertThat(result.characterSnapshotJson())
        .contains("Lan \\\"L\\\"")
        .contains("line one\\nline two");
  }
}
