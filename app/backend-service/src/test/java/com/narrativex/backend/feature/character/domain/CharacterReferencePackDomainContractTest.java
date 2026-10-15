package com.narrativex.backend.feature.character.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferencePolicy;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CharacterReferencePackDomainContractTest {
  @Test
  void existingVersionsDefaultToLegacyIdentityPolicy() {
    CharacterVersion legacy =
        CharacterVersion.rehydrate(
            UUID.randomUUID(),
            0L,
            UUID.randomUUID(),
            1,
            "bible",
            "visual prompt",
            CharacterVersionStatus.DRAFT,
            null);

    assertThat(legacy.getReferencePolicy()).isEqualTo(CharacterReferencePolicy.LEGACY_IDENTITY_V1);
    assertThat(legacy.getVisualProfile()).isNull();
  }

  @Test
  void multiViewPolicyDefinesTheEightCanonicalSlotsAndLegacyReferencesRemainSlotless() {
    assertThat(Arrays.stream(CharacterReferenceSlot.values()).map(Enum::name))
        .containsExactly(
            "FACE_FRONT",
            "FACE_THREE_QUARTER_LEFT",
            "FACE_THREE_QUARTER_RIGHT",
            "FACE_PROFILE_LEFT",
            "FACE_PROFILE_RIGHT",
            "BODY_FRONT",
            "BODY_SIDE",
            "BODY_BACK");

    var legacyReference = new CharacterVersionReference(UUID.randomUUID(), "IDENTITY", 0);
    assertThat(legacyReference.slot()).isNull();
  }

  @Test
  void multiViewVersionsKeepTheValidatedProfileAndDerivedVisualPrompt() {
    CharacterVisualProfile profile = profile(1, "adult");
    UUID basedOnVersionId = UUID.randomUUID();

    CharacterVersion version =
        CharacterVersion.createMultiView(UUID.randomUUID(), 2, "bible", profile, basedOnVersionId);

    assertThat(version.getReferencePolicy()).isEqualTo(CharacterReferencePolicy.MULTI_VIEW_V1);
    assertThat(version.getVisualProfile()).isEqualTo(profile);
    assertThat(version.getBasedOnVersionId()).isEqualTo(basedOnVersionId);
    assertThat(version.getVisualPrompt())
        .contains(
            "age=\"adult\"",
            "hair=\"black hair\", \"short bob\"",
            "heightCm=165",
            "headToBodyRatio=7.5");
  }

  @Test
  void characterAggregateCreatesMultiViewVersions() {
    Character character =
        Character.rehydrate(UUID.randomUUID(), 0L, "Mina", List.of(), CharacterStatus.ACTIVE);
    CharacterVersion version = character.createVersion(2, "bible", profile(1, "adult"), null);

    assertThat(version.getCharacterId()).isEqualTo(character.getId());
    assertThat(version.getReferencePolicy()).isEqualTo(CharacterReferencePolicy.MULTI_VIEW_V1);
  }

  @Test
  void referenceSlotRequiresItsCanonicalRoleAndPriority() {
    var reference =
        new CharacterVersionReference(
            UUID.randomUUID(), "PROFILE", 1, CharacterReferenceSlot.FACE_THREE_QUARTER_LEFT);

    assertThat(reference.slot()).isEqualTo(CharacterReferenceSlot.FACE_THREE_QUARTER_LEFT);
    assertThatThrownBy(
            () ->
                new CharacterVersionReference(
                    UUID.randomUUID(), "IDENTITY", 0, CharacterReferenceSlot.BODY_FRONT))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("match the reference slot");
  }

  @Test
  void visualProfileRejectsUnsupportedSchemaBlankValuesAndUnapprovedStyle() {
    assertThatThrownBy(() -> profile(2, "adult")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> profile(1, " ")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> profileWithStyle("UNLISTED_STYLE"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("styleKey is not supported");
    assertThatThrownBy(() -> profileWithHeight(BigDecimal.ZERO))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("heightCm must be positive");
    assertThatThrownBy(() -> profileWithFeatures(17))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("at most 16");
  }

  @Test
  void visualProfileAcceptsAllExistingImageStyleKeys() {
    assertThatCode(() -> profileWithStyle("CINEMATIC")).doesNotThrowAnyException();
    assertThatCode(() -> profileWithStyle("STORYBOOK_WATERCOLOR")).doesNotThrowAnyException();
    assertThatCode(() -> profileWithStyle("CINEMATIC_ANIME")).doesNotThrowAnyException();
  }

  private static CharacterVisualProfile profile(int schemaVersion, String ageDescription) {
    return new CharacterVisualProfile(
        schemaVersion,
        ageDescription,
        "oval face",
        "brown eyes",
        "warm skin",
        "black hair",
        "short bob",
        "slim",
        new BigDecimal("165"),
        new BigDecimal("7.5"),
        "compact stylized proportions",
        List.of("mole under left eye"),
        "plain dark jacket",
        "CINEMATIC_ANIME");
  }

  private static CharacterVisualProfile profileWithStyle(String styleKey) {
    return new CharacterVisualProfile(
        1,
        "adult",
        "oval face",
        "brown eyes",
        "warm skin",
        "black hair",
        "short bob",
        "slim",
        null,
        null,
        "compact stylized proportions",
        List.of(),
        "plain dark jacket",
        styleKey);
  }

  private static CharacterVisualProfile profileWithHeight(BigDecimal heightCm) {
    return new CharacterVisualProfile(
        1,
        "adult",
        "oval face",
        "brown eyes",
        "warm skin",
        "black hair",
        "short bob",
        "slim",
        heightCm,
        null,
        "compact stylized proportions",
        List.of(),
        "plain dark jacket",
        "CINEMATIC_ANIME");
  }

  private static CharacterVisualProfile profileWithFeatures(int count) {
    return new CharacterVisualProfile(
        1,
        "adult",
        "oval face",
        "brown eyes",
        "warm skin",
        "black hair",
        "short bob",
        "slim",
        null,
        null,
        "compact stylized proportions",
        Collections.nCopies(count, "feature"),
        "plain dark jacket",
        "CINEMATIC_ANIME");
  }
}
