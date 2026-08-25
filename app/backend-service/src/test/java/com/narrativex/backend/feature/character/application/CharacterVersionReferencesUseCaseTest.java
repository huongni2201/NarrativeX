package com.narrativex.backend.feature.character.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess.MediaAssetSummary;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.usecase.GetCharacterVersionReferencesUseCase;
import com.narrativex.backend.feature.character.application.usecase.SetCharacterVersionReferencesUseCase;
import com.narrativex.backend.feature.character.application.usecase.SetCharacterVersionReferencesUseCase.ReferenceInput;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CharacterVersionReferencesUseCaseTest {
  private static final UUID CHARACTER_ID = UuidV7.random();
  private static final UUID VERSION_ID = UuidV7.random();
  private static final UUID IDENTITY_ASSET = UuidV7.random();
  private static final UUID PROFILE_ASSET = UuidV7.random();

  @Mock private CharacterVersionRepository versionRepository;
  @Mock private CharacterVersionReferenceRepository referenceRepository;
  @Mock private MediaAssetAccess mediaAssetAccess;

  private final CurrentUserId currentUserId = () -> "owner";

  @Test
  void rejectsReferenceMutationAfterCharacterVersionIsLocked() {
    when(versionRepository.findOwnedById(VERSION_ID, "owner"))
        .thenReturn(Optional.of(version(CharacterVersionStatus.LOCKED)));
    var useCase = setUseCase();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    CHARACTER_ID,
                    VERSION_ID,
                    List.of(new ReferenceInput(IDENTITY_ASSET, "IDENTITY", 0))))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("immutable");

    verify(referenceRepository, never())
        .replace(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void rejectsNonReadyOrNonImageAssets() {
    when(versionRepository.findOwnedById(VERSION_ID, "owner"))
        .thenReturn(Optional.of(version(CharacterVersionStatus.DRAFT)));
    when(mediaAssetAccess.findOwnedSummary("owner", IDENTITY_ASSET))
        .thenReturn(Optional.of(asset(IDENTITY_ASSET, "VIDEO", "READY", "video/mp4")));
    var useCase = setUseCase();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    CHARACTER_ID,
                    VERSION_ID,
                    List.of(new ReferenceInput(IDENTITY_ASSET, "IDENTITY", 0))))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("READY image assets");

    verify(referenceRepository, never())
        .replace(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void requiresHighestPriorityReferenceToBeIdentityAndPersistsSortedReferences() {
    when(versionRepository.findOwnedById(VERSION_ID, "owner"))
        .thenReturn(Optional.of(version(CharacterVersionStatus.DRAFT)));
    when(mediaAssetAccess.findOwnedSummary("owner", IDENTITY_ASSET))
        .thenReturn(Optional.of(asset(IDENTITY_ASSET, "IMAGE", "READY", "image/png")));
    when(mediaAssetAccess.findOwnedSummary("owner", PROFILE_ASSET))
        .thenReturn(Optional.of(asset(PROFILE_ASSET, "IMAGE", "READY", "image/jpeg")));
    var useCase = setUseCase();

    assertThatThrownBy(
            () ->
                useCase.execute(
                    CHARACTER_ID,
                    VERSION_ID,
                    List.of(
                        new ReferenceInput(PROFILE_ASSET, "PROFILE", 0),
                        new ReferenceInput(IDENTITY_ASSET, "IDENTITY", 1))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("highest-priority");

    var saved =
        useCase.execute(
            CHARACTER_ID,
            VERSION_ID,
            List.of(
                new ReferenceInput(PROFILE_ASSET, "PROFILE", 1),
                new ReferenceInput(IDENTITY_ASSET, "identity", 0)));

    assertThat(saved)
        .extracting(
            CharacterVersionReference::mediaAssetId,
            CharacterVersionReference::role,
            CharacterVersionReference::priority)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple(IDENTITY_ASSET, "IDENTITY", 0),
            org.assertj.core.groups.Tuple.tuple(PROFILE_ASSET, "PROFILE", 1));
    verify(referenceRepository).replace(VERSION_ID, saved);
  }

  @Test
  void readsReferencesOnlyThroughOwnedCharacterVersion() {
    var expected = List.of(new CharacterVersionReference(IDENTITY_ASSET, "IDENTITY", 0));
    when(versionRepository.findOwnedById(VERSION_ID, "owner"))
        .thenReturn(Optional.of(version(CharacterVersionStatus.LOCKED)));
    when(referenceRepository.findByVersionId(VERSION_ID)).thenReturn(expected);
    var useCase =
        new GetCharacterVersionReferencesUseCase(
            currentUserId, versionRepository, referenceRepository);

    assertThat(useCase.execute(CHARACTER_ID, VERSION_ID)).isEqualTo(expected);
    verify(referenceRepository).findByVersionId(VERSION_ID);
  }

  private SetCharacterVersionReferencesUseCase setUseCase() {
    return new SetCharacterVersionReferencesUseCase(
        currentUserId, versionRepository, referenceRepository, mediaAssetAccess);
  }

  private static CharacterVersion version(CharacterVersionStatus status) {
    return CharacterVersion.rehydrate(
        VERSION_ID,
        0L,
        CHARACTER_ID,
        1,
        "character bible",
        "character visual prompt",
        status,
        status == CharacterVersionStatus.LOCKED ? Instant.parse("2026-08-23T00:00:00Z") : null,
        status == CharacterVersionStatus.LOCKED ? "owner" : null);
  }

  private static MediaAssetSummary asset(UUID id, String type, String status, String contentType) {
    return new MediaAssetSummary(id, type, status, contentType, null);
  }
}
