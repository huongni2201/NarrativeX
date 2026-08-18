package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateCharacterCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateCharacterUseCase {
  private final CharacterRepository characterRepository;
  private final CurrentUserId currentUserId;

  @Transactional
  public Character execute(CreateCharacterCommand command) {
    return characterRepository.save(
        Character.create(
            currentUserId.get(),
            command.workspaceId(),
            command.canonicalName(),
            command.aliases()));
  }
}
