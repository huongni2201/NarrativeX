package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateCharacterVersionCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
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
    CharacterVersion saved =
        versionRepository.save(
            character.createVersion(
                versionNumber,
                command.bible(),
                command.visualPrompt(),
                command.masterAssetId(),
                command.referenceAssetIds()));
    log.info(
        "Created character version id={} (versionNumber={}) for characterId={}",
        saved.getId(),
        saved.getVersionNumber(),
        command.characterId());
    return saved;
  }
}
