package com.narrativex.backend.feature.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateOutfitVersionCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.application.usecase.CreateOutfitVersionUseCase;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateOutfitVersionUseCaseTest {
  private static final UUID CHARACTER_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");

  @Mock private CharacterRepository characterRepository;
  @Mock private OutfitVersionRepository outfitVersionRepository;

  @Test
  void locksCharacterBeforeAllocatingNextVersion() {
    when(characterRepository.findOwnedByIdForUpdate(CHARACTER_ID, "owner"))
        .thenReturn(Optional.of(character()));
    when(outfitVersionRepository.findMaxVersionNumberByCharacterId(CHARACTER_ID)).thenReturn(3);
    when(outfitVersionRepository.save(any(OutfitVersion.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    CurrentUserId currentUserId = () -> "owner";
    CreateOutfitVersionUseCase useCase =
        new CreateOutfitVersionUseCase(characterRepository, outfitVersionRepository, currentUserId);

    OutfitVersion response =
        useCase.execute(
            new CreateOutfitVersionCommand(CHARACTER_ID, "Travel", null, "prompt", "owner"));

    assertEquals(4, response.getVersionNumber());
    verify(characterRepository).findOwnedByIdForUpdate(CHARACTER_ID, "owner");
    verify(characterRepository, never()).findOwnedById(CHARACTER_ID, "owner");
  }

  private static Character character() {
    return Character.rehydrate(
        CHARACTER_ID, 0L, "owner", null, "Mina", List.of(), CharacterStatus.ACTIVE);
  }
}
