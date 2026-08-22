package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
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
  private final CurrentUserId currentUserId;

  @Transactional
  public Character execute(CreateCharacterCommand command) {
    String ownerId = currentUserId.get();
    Character character =
        characterRepository.save(
            Character.create(
                ownerId,
                command.workspaceId(),
                command.canonicalName(),
                command.aliases()));
    log.info(
        "Created character id={} (canonicalName='{}', ownerId={}, workspaceId={})",
        character.getId(),
        character.getCanonicalName(),
        ownerId,
        command.workspaceId());
    return character;
  }
}
