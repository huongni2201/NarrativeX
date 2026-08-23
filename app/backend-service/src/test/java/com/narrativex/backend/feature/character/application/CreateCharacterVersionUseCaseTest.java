package com.narrativex.backend.feature.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateCharacterVersionCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.application.usecase.CreateCharacterVersionUseCase;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateCharacterVersionUseCaseTest {
  private static final UUID CHARACTER_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");

  @Mock private CharacterRepository characterRepository;
  @Mock private CharacterVersionRepository versionRepository;

  @Test
  void locksCharacterBeforeAllocatingNextVersion() {
    when(characterRepository.findOwnedByIdForUpdate(CHARACTER_ID, "owner"))
        .thenReturn(Optional.of(character()));
    when(versionRepository.findMaxVersionNumberByCharacterId(CHARACTER_ID)).thenReturn(3);
    when(versionRepository.save(any(CharacterVersion.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    CurrentUserId currentUserId = () -> "owner";
    CreateCharacterVersionUseCase useCase =
        new CreateCharacterVersionUseCase(characterRepository, versionRepository, currentUserId);

    CharacterVersion response =
        useCase.execute(new CreateCharacterVersionCommand(CHARACTER_ID, "bible", "visual prompt"));

    assertEquals(4, response.getVersionNumber());
    verify(characterRepository).findOwnedByIdForUpdate(CHARACTER_ID, "owner");
    verify(characterRepository, never()).findOwnedById(CHARACTER_ID, "owner");
  }

  private static Character character() {
    return Character.rehydrate(CHARACTER_ID, 0L, "owner", null, "Mina", List.of(), CharacterStatus.ACTIVE);
  }
}
