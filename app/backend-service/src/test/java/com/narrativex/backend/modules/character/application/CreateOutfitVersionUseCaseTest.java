package com.narrativex.backend.modules.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.character.application.command.CreateOutfitVersionCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.application.usecase.CreateOutfitVersionUseCase;
import com.narrativex.backend.modules.character.domain.aggregate.Character;
import com.narrativex.backend.modules.character.domain.aggregate.enums.CharacterStatus;
import com.narrativex.backend.modules.character.domain.aggregate.OutfitVersion;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateOutfitVersionUseCaseTest {
    @Mock private CharacterRepository characterRepository;
    @Mock private OutfitVersionRepository outfitVersionRepository;

    @Test
    void locksCharacterBeforeAllocatingNextVersion() {
        when(characterRepository.findOwnedByIdForUpdate(10L, "owner")).thenReturn(Optional.of(character()));
        when(outfitVersionRepository.findMaxVersionNumberByCharacterId(10L)).thenReturn(3);
        when(outfitVersionRepository.save(any(OutfitVersion.class))).thenAnswer(invocation -> invocation.getArgument(0));
        CurrentUserId currentUserId = requested -> requested == null ? "local-dev-user" : requested;
        CreateOutfitVersionUseCase useCase = new CreateOutfitVersionUseCase(characterRepository,
            outfitVersionRepository, currentUserId);

        var response = useCase.execute(new CreateOutfitVersionCommand(10L, "Travel", null, "prompt", "owner"));

        assertEquals(4, response.data().getVersionNumber());
        verify(characterRepository).findOwnedByIdForUpdate(10L, "owner");
        verify(characterRepository, never()).findOwnedById(10L, "owner");
    }

    private static Character character() {
        return Character.rehydrate(10L, 0L, "owner", null, "Mina", List.of(), CharacterStatus.ACTIVE);
    }
}
