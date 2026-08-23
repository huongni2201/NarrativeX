package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class VisualPromptComposerTest {

  private final VisualPromptComposer composer = new VisualPromptComposer(JsonMapper.builder().build());

  @Test
  void enrichesStillImagePromptWithStableCharacterAndLocationCanon() {
    var identityId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    var context =
        new VisualPromptContext(
            new LocationCanon(UuidV7.random(), "Kitchen", "old apartment kitchen", "warm practical lighting"),
            List.of(
                new CharacterCanon(
                    UuidV7.random(),
                    UuidV7.random(),
                    "Lan",
                    4,
                    "oval face, dark eyes, shoulder-length black hair",
                    "beige cardigan and white blouse",
                    "mid twenties",
                    "straight shoulder-length black hair",
                    null,
                    "beige cardigan",
                    List.of(
                        new CharacterReference(
                            identityId,
                            "IDENTITY",
                            0,
                            "private/characters/lan.png",
                            "image/png",
                            "a".repeat(64))))));

    var result = composer.compose(ImageStyle.CINEMATIC, "Lan opens the letter", context);

    assertThat(result.prompt())
        .contains("SCENE DESCRIPTION: Lan opens the letter")
        .contains("LOCATION CONTINUITY: Kitchen — warm practical lighting")
        .contains("CHARACTER CONTINUITY")
        .contains("REFERENCE IMAGE RULES")
        .contains("oval face, dark eyes")
        .contains("wardrobe: beige cardigan")
        .contains("CONTINUITY RULES");
    assertThat(result.characterSnapshotJson())
        .contains("\"canonicalName\":\"Lan\"")
        .contains("\"versionNumber\":4")
        .contains(identityId.toString())
        .contains("private/characters/lan.png")
        .contains("\"sha256\":\"" + "a".repeat(64) + "\"");
  }

  @Test
  void keepsPromptExecutableWhenSceneHasNoCanonYet() {
    var result = composer.compose(ImageStyle.CINEMATIC, "Empty hallway at dawn", null);

    assertThat(result.prompt())
        .contains("SCENE DESCRIPTION: Empty hallway at dawn")
        .contains("CONTINUITY RULES")
        .doesNotContain("CHARACTER CONTINUITY")
        .doesNotContain("LOCATION CONTINUITY")
        .doesNotContain("REFERENCE IMAGE RULES");
    assertThat(result.characterSnapshotJson()).isEqualTo("{\"characters\":[]}");
  }

  @Test
  void escapesCharacterSnapshotAsValidJsonText() {
    var context =
        new VisualPromptContext(
            null,
            List.of(
                new CharacterCanon(
                    UuidV7.random(),
                    UuidV7.random(),
                    "Lan \"L\"",
                    1,
                    "line one\nline two",
                    null,
                    null,
                    null,
                    null,
                    null,
                    List.of())));

    var result = composer.compose(ImageStyle.CINEMATIC, "Portrait", context);

    assertThat(result.characterSnapshotJson())
        .contains("Lan \\\"L\\\"")
        .contains("line one\\nline two");
  }

  @Test
  void givesEachCharacterAnIdentityAnchorBeforeUsingSecondaryReferences() {
    var lanIdentity = reference("10000000-0000-0000-0000-000000000001", "IDENTITY", 0, "a");
    var lanProfile = reference("10000000-0000-0000-0000-000000000002", "PROFILE", 1, "b");
    var lanExpression = reference("10000000-0000-0000-0000-000000000003", "EXPRESSION", 2, "c");
    var minhIdentity = reference("20000000-0000-0000-0000-000000000001", "IDENTITY", 0, "d");
    var context =
        new VisualPromptContext(
            null,
            List.of(
                canon(UuidV7.random(), "Lan", List.of(lanIdentity, lanProfile, lanExpression)),
                canon(UuidV7.random(), "Minh", List.of(minhIdentity))));

    var result = composer.compose(ImageStyle.CINEMATIC, "Lan and Minh speak", context);

    assertThat(result.characterSnapshotJson())
        .contains(lanIdentity.assetId().toString())
        .contains(minhIdentity.assetId().toString())
        .contains(lanProfile.assetId().toString())
        .doesNotContain(lanExpression.assetId().toString());
  }

  private static CharacterCanon canon(
      UUID assignmentId, String name, List<CharacterReference> references) {
    return new CharacterCanon(
        assignmentId,
        UuidV7.random(),
        name,
        1,
        name + " visual canon",
        null,
        null,
        null,
        null,
        null,
        references);
  }

  private static CharacterReference reference(
      String assetId, String role, int priority, String digestChar) {
    return new CharacterReference(
        UUID.fromString(assetId),
        role,
        priority,
        "private/characters/" + role.toLowerCase() + ".png",
        "image/png",
        digestChar.repeat(64));
  }
}
