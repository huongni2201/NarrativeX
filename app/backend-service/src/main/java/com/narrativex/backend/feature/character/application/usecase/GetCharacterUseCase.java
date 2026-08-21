package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Deep, ownership-scoped detail seam for one reusable workspace character. */
@Service
@RequiredArgsConstructor
public class GetCharacterUseCase {
  private final CharacterRepository characterRepository;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public Character execute(Long characterId) {
    return characterRepository
        .findOwnedById(characterId, currentUserId.get())
        .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
  }
}
