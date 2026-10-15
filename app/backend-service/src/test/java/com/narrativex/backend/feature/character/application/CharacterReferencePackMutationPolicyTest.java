package com.narrativex.backend.feature.character.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.usecase.SetCharacterVersionReferencesUseCase;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferencePolicy;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class CharacterReferencePackMutationPolicyTest {
  @Test
  void multiViewReferencesCannotBypassCandidateReviewThroughLegacyPut() {
    UUID characterId = UUID.randomUUID();
    CharacterVersion version = multiViewVersion(characterId);
    CharacterVersionRepository versionRepository =
        new CharacterVersionRepository() {
          @Override
          public int findMaxVersionNumberByCharacterId(UUID id) {
            throw new UnsupportedOperationException();
          }

          @Override
          public Optional<CharacterVersion> findById(UUID id) {
            return Optional.of(version);
          }

          @Override
          public Optional<CharacterVersion> findByIdForUpdate(UUID id) {
            return Optional.of(version);
          }

          @Override
          public CharacterVersion save(CharacterVersion value) {
            return value;
          }
        };
    CharacterVersionReferenceRepository referenceRepository =
        new CharacterVersionReferenceRepository() {
          @Override
          public List<CharacterVersionReference> findByVersionId(UUID versionId) {
            return List.of();
          }

          @Override
          public void replace(UUID versionId, List<CharacterVersionReference> values) {
            throw new AssertionError("legacy mutation must not replace active slots");
          }
        };
    MediaAssetAccess mediaAssetAccess =
        assetId -> {
          throw new AssertionError("legacy mutation must stop before asset lookup");
        };
    var useCase =
        new SetCharacterVersionReferencesUseCase(
            versionRepository, referenceRepository, mediaAssetAccess);

    assertThatThrownBy(() -> useCase.execute(characterId, version.getId(), List.of()))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("candidate review");
  }

  @Test
  void multiViewReferenceImportsPersistTheirCanonicalSlot() {
    UUID characterId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    CharacterVersion version = multiViewVersion(characterId);
    CharacterVersionRepository versionRepository =
        new CharacterVersionRepository() {
          @Override
          public int findMaxVersionNumberByCharacterId(UUID id) {
            throw new UnsupportedOperationException();
          }

          @Override
          public Optional<CharacterVersion> findById(UUID id) {
            return Optional.of(version);
          }

          @Override
          public Optional<CharacterVersion> findByIdForUpdate(UUID id) {
            return Optional.of(version);
          }

          @Override
          public CharacterVersion save(CharacterVersion value) {
            return value;
          }
        };
    AtomicReference<List<CharacterVersionReference>> savedReferences = new AtomicReference<>();
    CharacterVersionReferenceRepository referenceRepository =
        new CharacterVersionReferenceRepository() {
          @Override
          public List<CharacterVersionReference> findByVersionId(UUID versionId) {
            return List.of();
          }

          @Override
          public void replace(UUID versionId, List<CharacterVersionReference> values) {
            savedReferences.set(values);
          }
        };
    MediaAssetAccess mediaAssetAccess =
        ignored ->
            Optional.of(
                new MediaAssetAccess.MediaAssetSummary(
                    assetId, "IMAGE", "READY", "image/png", null));
    var useCase =
        new SetCharacterVersionReferencesUseCase(
            versionRepository, referenceRepository, mediaAssetAccess);

    var references =
        useCase.execute(
            characterId,
            version.getId(),
            List.of(
                new SetCharacterVersionReferencesUseCase.ReferenceInput(
                    assetId, "IDENTITY", 0, CharacterReferenceSlot.FACE_FRONT)));

    assertThat(references).containsExactlyElementsOf(savedReferences.get());
    assertThat(references.getFirst().slot()).isEqualTo(CharacterReferenceSlot.FACE_FRONT);
  }

  private static CharacterVersion multiViewVersion(UUID characterId) {
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
        UUID.randomUUID(),
        0L,
        characterId,
        2,
        "bible",
        profile.toVisualPrompt(),
        CharacterVersionStatus.DRAFT,
        null,
        CharacterReferencePolicy.MULTI_VIEW_V1,
        profile,
        null);
  }
}
