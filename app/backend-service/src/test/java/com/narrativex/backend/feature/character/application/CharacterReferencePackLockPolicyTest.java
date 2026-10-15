package com.narrativex.backend.feature.character.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.character.application.command.ChangeCharacterVersionStatusCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.usecase.LockCharacterVersionUseCase;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferencePolicy;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CharacterReferencePackLockPolicyTest {
  @Test
  void multiViewVersionCannotLockUntilAllEightSlotsAreActive() {
    UUID characterId = UUID.randomUUID();
    UUID versionId = UUID.randomUUID();
    CharacterVersion version = multiViewVersion(versionId, characterId);
    List<CharacterVersionReference> references =
        referencesMissing(CharacterReferenceSlot.BODY_BACK);
    var useCase = useCase(version, references);

    assertThatThrownBy(() -> useCase.execute(new ChangeCharacterVersionStatusCommand(versionId)))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("BODY_BACK");
  }

  @Test
  void multiViewVersionCannotLockWhenASlotIsDuplicated() {
    UUID characterId = UUID.randomUUID();
    UUID versionId = UUID.randomUUID();
    CharacterVersion version = multiViewVersion(versionId, characterId);
    List<CharacterVersionReference> references = new ArrayList<>(referencesForAllSlots());
    CharacterReferenceSlot duplicate = CharacterReferenceSlot.FACE_FRONT;
    references.add(
        new CharacterVersionReference(
            UUID.randomUUID(), duplicate.role(), duplicate.priority(), duplicate));
    var useCase = useCase(version, references);

    assertThatThrownBy(() -> useCase.execute(new ChangeCharacterVersionStatusCommand(versionId)))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("FACE_FRONT");
  }

  @Test
  void multiViewVersionCannotLockWithAnExtraSlotlessReference() {
    UUID characterId = UUID.randomUUID();
    UUID versionId = UUID.randomUUID();
    CharacterVersion version = multiViewVersion(versionId, characterId);
    List<CharacterVersionReference> references = new ArrayList<>(referencesForAllSlots());
    references.add(new CharacterVersionReference(UUID.randomUUID(), "IDENTITY", 0));
    var useCase = useCase(version, references);

    assertThatThrownBy(() -> useCase.execute(new ChangeCharacterVersionStatusCommand(versionId)))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("slotless");
  }

  @Test
  void completeMultiViewPackCanLock() {
    UUID characterId = UUID.randomUUID();
    UUID versionId = UUID.randomUUID();
    CharacterVersion version = multiViewVersion(versionId, characterId);
    var useCase = useCase(version, referencesForAllSlots());

    CharacterVersion locked = useCase.execute(new ChangeCharacterVersionStatusCommand(versionId));

    assertThat(locked.getStatus()).isEqualTo(CharacterVersionStatus.LOCKED);
  }

  @Test
  void legacyIdentityOnlyVersionCanStillLock() {
    UUID characterId = UUID.randomUUID();
    UUID versionId = UUID.randomUUID();
    CharacterVersion version =
        CharacterVersion.rehydrate(
            versionId,
            0L,
            characterId,
            1,
            "bible",
            "visual prompt",
            CharacterVersionStatus.REVIEW,
            null);
    var useCase =
        useCase(version, List.of(new CharacterVersionReference(UUID.randomUUID(), "IDENTITY", 0)));

    CharacterVersion locked = useCase.execute(new ChangeCharacterVersionStatusCommand(versionId));

    assertThat(locked.getStatus()).isEqualTo(CharacterVersionStatus.LOCKED);
    assertThat(locked.getReferencePolicy()).isEqualTo(CharacterReferencePolicy.LEGACY_IDENTITY_V1);
  }

  private static LockCharacterVersionUseCase useCase(
      CharacterVersion version, List<CharacterVersionReference> references) {
    CharacterVersionRepository versions =
        new CharacterVersionRepository() {
          @Override
          public int findMaxVersionNumberByCharacterId(UUID characterId) {
            throw new UnsupportedOperationException();
          }

          @Override
          public Optional<CharacterVersion> findById(UUID characterVersionId) {
            return Optional.of(version);
          }

          @Override
          public Optional<CharacterVersion> findByIdForUpdate(UUID characterVersionId) {
            return Optional.of(version);
          }

          @Override
          public CharacterVersion save(CharacterVersion characterVersion) {
            return characterVersion;
          }
        };
    CharacterVersionReferenceRepository versionReferences =
        new CharacterVersionReferenceRepository() {
          @Override
          public List<CharacterVersionReference> findByVersionId(UUID characterVersionId) {
            return references;
          }

          @Override
          public void replace(UUID characterVersionId, List<CharacterVersionReference> values) {
            throw new UnsupportedOperationException();
          }
        };
    return new LockCharacterVersionUseCase(versions, versionReferences);
  }

  private static List<CharacterVersionReference> referencesForAllSlots() {
    return Arrays.stream(CharacterReferenceSlot.values())
        .map(
            slot ->
                new CharacterVersionReference(
                    UUID.randomUUID(), slot.role(), slot.priority(), slot))
        .toList();
  }

  private static List<CharacterVersionReference> referencesMissing(CharacterReferenceSlot missing) {
    return Arrays.stream(CharacterReferenceSlot.values())
        .filter(slot -> slot != missing)
        .map(
            slot ->
                new CharacterVersionReference(
                    UUID.randomUUID(), slot.role(), slot.priority(), slot))
        .toList();
  }

  private static CharacterVersion multiViewVersion(UUID versionId, UUID characterId) {
    CharacterVisualProfile profile =
        new CharacterVisualProfile(
            1,
            "adult",
            "oval",
            "brown eyes",
            "warm skin",
            "black hair",
            "short bob",
            "slim",
            new BigDecimal("165"),
            new BigDecimal("7.5"),
            "compact proportions",
            List.of(),
            "plain dark jacket",
            "CINEMATIC_ANIME");
    return CharacterVersion.rehydrate(
        versionId,
        0L,
        characterId,
        2,
        "bible",
        profile.toVisualPrompt(),
        CharacterVersionStatus.REVIEW,
        Instant.parse("2026-10-12T00:00:00Z"),
        CharacterReferencePolicy.MULTI_VIEW_V1,
        profile,
        null);
  }
}
