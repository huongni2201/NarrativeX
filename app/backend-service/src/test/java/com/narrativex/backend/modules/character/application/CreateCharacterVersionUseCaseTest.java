package com.narrativex.backend.modules.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.character.application.command.CreateCharacterVersionCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.application.usecase.CreateCharacterVersionUseCase;
import com.narrativex.backend.modules.character.domain.aggregate.Character;
import com.narrativex.backend.modules.character.domain.aggregate.enums.CharacterStatus;
import com.narrativex.backend.modules.character.domain.aggregate.CharacterVersion;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateCharacterVersionUseCaseTest {
    @Mock private CharacterRepository characterRepository;
    @Mock private CharacterVersionRepository versionRepository;

    @Test
    void locksCharacterBeforeAllocatingNextVersion() {
        when(characterRepository.findOwnedByIdForUpdate(10L, "owner")).thenReturn(Optional.of(character()));
        when(versionRepository.findMaxVersionNumberByCharacterId(10L)).thenReturn(3);
        when(versionRepository.save(any(CharacterVersion.class))).thenAnswer(invocation -> invocation.getArgument(0));
        CurrentUserId currentUserId = requested -> requested == null ? "local-dev-user" : requested;
        CreateCharacterVersionUseCase useCase = new CreateCharacterVersionUseCase(characterRepository,
            versionRepository, currentUserId);

        var response = useCase.execute(new CreateCharacterVersionCommand(10L, "bible",
            "visual prompt", null, List.of(), "owner"));

        assertEquals(4, response.data().getVersionNumber());
        verify(characterRepository).findOwnedByIdForUpdate(10L, "owner");
        verify(characterRepository, never()).findOwnedById(10L, "owner");
    }

    private static Character character() {
        return Character.rehydrate(10L, 0L, "owner", null, "Mina", List.of(), CharacterStatus.ACTIVE);
    }
}
