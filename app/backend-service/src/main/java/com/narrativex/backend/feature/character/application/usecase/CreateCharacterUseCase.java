package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.command.CreateCharacterCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateCharacterUseCase {
  private final CharacterRepository characterRepository;

  @Transactional
  public Character execute(CreateCharacterCommand command) {
    Character character =
        characterRepository.save(
            Character.create(command.canonicalName(), command.aliases()));
    log.info(
        "Created character id={} (canonicalName='{}')",
        character.getId(),
        character.getCanonicalName());
    return character;
  }
}
