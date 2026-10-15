package com.narrativex.backend.feature.character.application.usecase;

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

  @Transactional
  public CharacterVersion execute(CreateCharacterVersionCommand command) {
    var character =
        characterRepository
            .findByIdForUpdate(command.characterId())
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
    int versionNumber = versionRepository.findMaxVersionNumberByCharacterId(character.getId()) + 1;
    if (command.visualProfile() != null) {
      if (command.basedOnVersionId() != null) {
        var baseVersion =
            versionRepository
                .findById(command.basedOnVersionId())
                .orElseThrow(() -> new ResourceNotFoundException("Base character version not found"));
        if (!baseVersion.getCharacterId().equals(character.getId())) {
          throw new IllegalArgumentException("Base character version must belong to this character");
        }
      }
    } else if (command.visualPrompt() == null || command.visualPrompt().isBlank()) {
      throw new IllegalArgumentException("visualPrompt is required for a legacy character version");
    }
    CharacterVersion saved =
        versionRepository.save(
            command.visualProfile() != null
                ? character.createVersion(
                    versionNumber,
                    command.bible(),
                    command.visualProfile(),
                    command.basedOnVersionId())
                : character.createVersion(versionNumber, command.bible(), command.visualPrompt()));
    log.info(
        "Created character version id={} (versionNumber={}) for characterId={}",
        saved.getId(),
        saved.getVersionNumber(),
        command.characterId());
    return saved;
  }
}
