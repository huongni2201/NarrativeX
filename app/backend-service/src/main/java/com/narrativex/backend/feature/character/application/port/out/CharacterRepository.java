package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.Optional;
import java.util.UUID;

public interface CharacterRepository {
  CursorPage<Character> findActiveByOwnerId(String ownerId, String cursor, int limit);

  long countActiveByOwnerId(String ownerId);

  Character save(Character character);

  Optional<Character> findOwnedById(UUID characterId, String ownerId);

  Optional<Character> findOwnedByIdForUpdate(UUID characterId, String ownerId);
}
