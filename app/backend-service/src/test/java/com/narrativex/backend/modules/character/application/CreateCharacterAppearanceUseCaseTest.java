package com.narrativex.backend.modules.character.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.character.application.command.CreateCharacterAppearanceCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.application.usecase.CreateCharacterAppearanceUseCase;
import com.narrativex.backend.modules.character.domain.model.Character;
import com.narrativex.backend.modules.character.domain.model.CharacterStatus;
import com.narrativex.backend.modules.character.domain.model.OutfitVersion;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateCharacterAppearanceUseCaseTest {
    @Mock
    private CharacterRepository characterRepository;
    @Mock
    private CharacterAppearanceRepository appearanceRepository;
    @Mock
    private OutfitVersionRepository outfitVersionRepository;
    @Mock
    private ProjectAccess projectAccess;

    private CreateCharacterAppearanceUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new CreateCharacterAppearanceUseCase(characterRepository, appearanceRepository,
            outfitVersionRepository, projectAccess, new CurrentUserId(false, "local-dev-user"));
        when(characterRepository.findOwnedById(10L, "owner"))
            .thenReturn(Optional.of(character(10L)));
    }

    @Test
    void verifiesProjectOwnershipBeforeSavingAppearance() {
        when(projectAccess.findOwnedProject(100L, "owner"))
            .thenThrow(new ResourceNotFoundException("Project not found"));

        assertThrows(ResourceNotFoundException.class,
            () -> useCase.execute(command(100L, null), "owner"));

        verify(appearanceRepository, never()).save(any());
        verify(outfitVersionRepository, never()).findOwnedById(any(), any());
    }

    @Test
    void rejectsAnOutfitVersionThatIsNotOwnedByTheCurrentUser() {
        when(outfitVersionRepository.findOwnedById(500L, "owner"))
            .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
            () -> useCase.execute(command(100L, 500L), "owner"));

        verify(appearanceRepository, never()).save(any());
    }

    @Test
    void rejectsAnOutfitVersionBelongingToAnotherCharacter() {
        when(outfitVersionRepository.findOwnedById(500L, "owner"))
            .thenReturn(Optional.of(outfit(500L, 20L)));

        assertThrows(IllegalArgumentException.class,
            () -> useCase.execute(command(100L, 500L), "owner"));

        verify(appearanceRepository, never()).save(any());
    }

    @Test
    void savesOnlyAfterAllOptionalReferencesPassOwnershipChecks() {
        when(outfitVersionRepository.findOwnedById(500L, "owner"))
            .thenReturn(Optional.of(outfit(500L, 10L)));

        useCase.execute(command(100L, 500L), "owner");

        verify(projectAccess).findOwnedProject(100L, "owner");
        verify(outfitVersionRepository).findOwnedById(500L, "owner");
        verify(appearanceRepository).save(any());
    }

    @Test
    void doesNotResolveOptionalReferencesWhenTheyAreAbsent() {
        useCase.execute(command(null, null), "owner");

        verify(projectAccess, never()).findOwnedProject(any(), any());
        verify(outfitVersionRepository, never()).findOwnedById(any(), any());
        verify(appearanceRepository).save(any());
    }

    private static CreateCharacterAppearanceCommand command(Long projectId, Long outfitVersionId) {
        return new CreateCharacterAppearanceCommand(10L, projectId, "chapter-1", "adult", "short hair",
            null, "travel clothes", "prompt", outfitVersionId);
    }

    private static Character character(Long id) {
        return Character.rehydrate(id, 0L, "owner", null, "Mina", java.util.List.of(), CharacterStatus.ACTIVE);
    }

    private static OutfitVersion outfit(Long id, Long characterId) {
        return OutfitVersion.rehydrate(id, 0L, characterId, 1, "Travel", null, "prompt",
            com.narrativex.backend.modules.character.domain.model.OutfitVersionStatus.DRAFT);
    }
}
