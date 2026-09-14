package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.Optional;
import java.util.UUID;

public interface CharacterRepository {
  CursorPage<Character> findActive(String cursor, int limit);

  long countActive();

  Character save(Character character);

  Optional<Character> findById(UUID characterId);

  Optional<Character> findByIdForUpdate(UUID characterId);
}
