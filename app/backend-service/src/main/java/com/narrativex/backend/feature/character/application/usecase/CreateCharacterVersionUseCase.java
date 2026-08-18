package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateCharacterVersionCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateCharacterVersionUseCase {
  private final CharacterRepository characterRepository;
  private final CharacterVersionRepository versionRepository;
  private final CurrentUserId currentUserId;

  @Transactional
  public CharacterVersion execute(CreateCharacterVersionCommand command) {
    String ownerId = currentUserId.get();
    var character =
        characterRepository
            .findOwnedByIdForUpdate(command.characterId(), ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
    int versionNumber = versionRepository.findMaxVersionNumberByCharacterId(character.getId()) + 1;
    return versionRepository.save(
        character.createVersion(
            versionNumber,
            command.bible(),
            command.visualPrompt(),
            command.masterAssetId(),
            command.referenceAssetIds()));
  }
}
