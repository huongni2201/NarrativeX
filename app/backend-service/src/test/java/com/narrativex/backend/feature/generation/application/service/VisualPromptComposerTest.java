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
  private static final String DIRECTION =
      "{\"shot_size\":\"MEDIUM_CLOSE_UP\",\"camera_angle\":\"LOW\",\"lens_mm\":50,"
          + "\"focus_target\":\"Lan's hand gripping the letter\",\"action_phase\":\"AFTER\","
          + "\"subject_placement\":\"Lan on left third\",\"foreground\":\"desk edge\","
          + "\"background\":\"old apartment kitchen\",\"motivated_light\":\"window light from left\","
          + "\"palette\":\"desaturated blue with warm practical accents\",\"camera_movement\":\"PUSH_IN\","
          + "\"movement_direction\":null,\"movement_intensity\":\"SUBTLE\","
          + "\"crop_safe_area\":\"above and right\"}";

  private final VisualPromptComposer composer =
      new VisualPromptComposer(JsonMapper.builder().build());

  @Test
  void ordersStoryAndStructuredShotBeforeStyle() {
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
        .contains("Camera movement: PUSH_IN")
        .contains("Motion-safe area: above and right")
        .doesNotContain("STYLE PROFILE:")
        .doesNotContain("VISUAL VARIETY: avoid repetitive centered framing");
  }

  @Test
  void separatesCanonicalIdentityFromCurrentStateAndEmitsIdentityOnce() {
    var identityId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    var character =
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
            "PRIMARY",
            List.of(
                new CharacterReference(
                    identityId,
                    "IDENTITY",
                    0,
                    "private/characters/lan.png",
                    "image/png",
                    "a".repeat(64))));
    var context =
        new VisualPromptContext(
            new LocationCanon(
                UuidV7.random(),
                "Kitchen",
                "old apartment kitchen",
                "warm practical kitchen with dark walnut cabinets"),
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
        .contains("ENVIRONMENT\nKitchen — warm practical kitchen with dark walnut cabinets")
        .contains("REFERENCE MAP\n- REF_01 = Lan [PRIMARY]")
        .doesNotContain("STORYBOARD CHARACTER QUALITY RULES")
        .doesNotContain("CONSISTENCY PRECEDENCE:");
    assertThat(count(result.prompt(), "oval face, dark eyes, shoulder-length black hair")).isEqualTo(1);
    assertThat(result.characterSnapshotJson())
        .contains("\"canonicalName\":\"Lan\"")
        .contains("\"versionNumber\":4")
        .contains(identityId.toString());
    assertThat(result.referenceBindings()).hasSize(1);
  }

  @Test
  void wideShotDoesNotReceivePortraitOnlyNegativeConstraint() {
    String wide = DIRECTION.replace("MEDIUM_CLOSE_UP", "WIDE");
    var result =
        composer.compose(
            ImageStyle.CINEMATIC_ANIME,
            "Lan crosses the courtyard",
            wide,
            "16:9",
            VisualPromptContext.empty());

    assertThat(result.negativePrompt()).doesNotContain("character too small in frame");
  }

  @Test
  void legacyBeatWithoutStructuredDirectionGetsSafeDeterministicDefault() {
    var result = composer.compose(ImageStyle.CINEMATIC, "Empty hallway at dawn", VisualPromptContext.empty());

    assertThat(result.prompt())
        .contains("Shot size: MEDIUM")
        .contains("Camera angle: EYE_LEVEL")
        .contains("Camera movement: NONE")
        .contains("STYLE\nGrounded cinematic film-still rendering");
  }

  @Test
  void referenceSelectionStillGivesEachCharacterAnIdentityAnchorFirst() {
    var lanIdentity = reference("10000000-0000-0000-0000-000000000001", "IDENTITY", 9, "a");
    var lanProfile = reference("10000000-0000-0000-0000-000000000002", "PROFILE", 1, "b");
    var lanExpression = reference("10000000-0000-0000-0000-000000000003", "EXPRESSION", 0, "c");
    var minhIdentity = reference("20000000-0000-0000-0000-000000000001", "IDENTITY", 5, "d");
    var context =
        new VisualPromptContext(
            null,
            List.of(
                canon(UuidV7.random(), "Lan", "PRIMARY", List.of(lanExpression, lanProfile, lanIdentity)),
                canon(UuidV7.random(), "Minh", "SECONDARY", List.of(minhIdentity))));

    var result = composer.compose(ImageStyle.CINEMATIC, "Lan and Minh speak", context);

    assertThat(result.referenceBindings())
        .extracting(VisualPromptComposer.ReferenceBinding::assetId)
        .containsExactly(lanIdentity.assetId(), minhIdentity.assetId(), lanProfile.assetId());
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

  private static CharacterCanon canon(
      UUID assignmentId, String name, String beatRole, List<CharacterReference> references) {
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
        beatRole,
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
