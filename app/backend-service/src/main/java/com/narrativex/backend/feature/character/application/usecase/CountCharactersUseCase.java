package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CountCharactersUseCase {
  private final CharacterRepository characterRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public long execute() {
    return characterRepository.countActiveByOwnerId(currentUserId.get());
  }
}
