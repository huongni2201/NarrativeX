package com.narrativex.backend.feature.character.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateCharacterAppearanceCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.application.usecase.CreateCharacterAppearanceUseCase;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.enums.OutfitVersionStatus;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateCharacterAppearanceUseCaseTest {
  @Mock private CharacterRepository characterRepository;
  @Mock private CharacterAppearanceRepository appearanceRepository;
  @Mock private OutfitVersionRepository outfitVersionRepository;
  @Mock private ProjectAccess projectAccess;
  private CreateCharacterAppearanceUseCase useCase;

  private static final UUID CHARACTER_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
  private static final UUID OTHER_CHARACTER_ID = UUID.fromString("00000000-0000-0000-0000-000000000020");
  private static final UUID PROJECT_ID = UUID.fromString("00000000-0000-0000-0000-000000000100");
  private static final UUID OUTFIT_ID = UUID.fromString("00000000-0000-0000-0000-000000000500");

  @BeforeEach
  void setUp() {
    CurrentUserId currentUserId = () -> "owner";
    useCase =
        new CreateCharacterAppearanceUseCase(
            characterRepository,
            appearanceRepository,
            outfitVersionRepository,
            projectAccess,
            currentUserId);
    when(characterRepository.findOwnedById(CHARACTER_ID, "owner")).thenReturn(Optional.of(character(CHARACTER_ID)));
  }

  @Test
  void verifiesProjectOwnershipBeforeSavingAppearance() {
    when(projectAccess.findOwnedProject(PROJECT_ID, "owner"))
        .thenThrow(new ResourceNotFoundException("Project not found"));
    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(command(PROJECT_ID, null)));
    verify(appearanceRepository, never()).save(any());
    verify(outfitVersionRepository, never()).findOwnedById(any(), any());
  }

  @Test
  void rejectsAnOutfitVersionThatIsNotOwnedByTheCurrentUser() {
    when(outfitVersionRepository.findOwnedById(OUTFIT_ID, "owner")).thenReturn(Optional.empty());
    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(command(PROJECT_ID, OUTFIT_ID)));
    verify(appearanceRepository, never()).save(any());
  }

  @Test
  void rejectsAnOutfitVersionBelongingToAnotherCharacter() {
    when(outfitVersionRepository.findOwnedById(OUTFIT_ID, "owner"))
        .thenReturn(Optional.of(outfit(OUTFIT_ID, OTHER_CHARACTER_ID)));
    assertThrows(IllegalArgumentException.class, () -> useCase.execute(command(PROJECT_ID, OUTFIT_ID)));
    verify(appearanceRepository, never()).save(any());
  }

  @Test
  void savesOnlyAfterAllOptionalReferencesPassOwnershipChecks() {
    when(outfitVersionRepository.findOwnedById(OUTFIT_ID, "owner"))
        .thenReturn(Optional.of(outfit(OUTFIT_ID, CHARACTER_ID)));
    useCase.execute(command(PROJECT_ID, OUTFIT_ID));
    verify(projectAccess).findOwnedProject(PROJECT_ID, "owner");
    verify(outfitVersionRepository).findOwnedById(OUTFIT_ID, "owner");
    verify(appearanceRepository).save(any());
  }

  @Test
  void doesNotResolveOptionalReferencesWhenTheyAreAbsent() {
    useCase.execute(command(null, null));
    verify(projectAccess, never()).findOwnedProject(any(), any());
    verify(outfitVersionRepository, never()).findOwnedById(any(), any());
    verify(appearanceRepository).save(any());
  }

  private static CreateCharacterAppearanceCommand command(UUID projectId, UUID outfitVersionId) {
    return new CreateCharacterAppearanceCommand(
        CHARACTER_ID,
        projectId,
        "chapter-1",
        "adult",
        "short hair",
        null,
        "travel clothes",
        "prompt",
        outfitVersionId,
        "owner");
  }

  private static Character character(UUID id) {
    return Character.rehydrate(
        id, 0L, "owner", null, "Mina", java.util.List.of(), CharacterStatus.ACTIVE);
  }

  private static OutfitVersion outfit(UUID id, UUID characterId) {
    return OutfitVersion.rehydrate(
        id, 0L, characterId, 1, "Travel", null, "prompt", OutfitVersionStatus.DRAFT);
  }
}
