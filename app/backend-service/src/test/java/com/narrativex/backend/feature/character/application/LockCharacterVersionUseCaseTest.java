package com.narrativex.backend.feature.character.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.command.ChangeCharacterVersionStatusCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.usecase.LockCharacterVersionUseCase;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LockCharacterVersionUseCaseTest {
  private static final UUID CHARACTER_ID = UuidV7.random();
  private static final UUID VERSION_ID = UuidV7.random();
  private static final UUID IDENTITY_ASSET_ID = UuidV7.random();

  @Mock private CharacterVersionRepository versionRepository;
  @Mock private CharacterVersionReferenceRepository referenceRepository;

  @Test
  void rejectsLockWhenIdentityReferenceIsMissing() {
    var version = reviewVersion();
    when(versionRepository.findByIdForUpdate(VERSION_ID))
        .thenReturn(Optional.of(version));
    when(referenceRepository.findByVersionId(VERSION_ID)).thenReturn(List.of());
    var useCase =
        new LockCharacterVersionUseCase(versionRepository, referenceRepository);

    assertThatThrownBy(
            () -> useCase.execute(new ChangeCharacterVersionStatusCommand(VERSION_ID)))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("IDENTITY");

    verify(versionRepository, never()).save(version);
  }

  @Test
  void locksReviewedVersionWhenIdentityReferenceExists() {
    var version = reviewVersion();
    when(versionRepository.findByIdForUpdate(VERSION_ID))
        .thenReturn(Optional.of(version));
    when(referenceRepository.findByVersionId(VERSION_ID))
        .thenReturn(List.of(new CharacterVersionReference(IDENTITY_ASSET_ID, "IDENTITY", 0)));
    when(versionRepository.save(version)).thenReturn(version);
    var useCase =
        new LockCharacterVersionUseCase(versionRepository, referenceRepository);

    var locked = useCase.execute(new ChangeCharacterVersionStatusCommand(VERSION_ID));

    assertThat(locked.getStatus()).isEqualTo(CharacterVersionStatus.LOCKED);
    assertThat(locked.getLockedAt()).isNotNull();
    verify(versionRepository).save(version);
  }

  private static CharacterVersion reviewVersion() {
    return CharacterVersion.rehydrate(
        VERSION_ID,
        0L,
        CHARACTER_ID,
        1,
        "character bible",
        "character visual prompt",
        CharacterVersionStatus.REVIEW,
        null);
  }
}

