package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.query.CharacterListQuery;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListCharactersUseCase {
  private final CharacterRepository characterRepository;

  @Transactional(readOnly = true)
  public CursorPage<Character> execute(CharacterListQuery query) {
    return characterRepository.findActive(query.cursor(), query.limit());
  }
}
