package com.narrativex.backend.modules.character.application.port.out;

import com.narrativex.backend.modules.character.domain.aggregate.Character;
import java.util.Optional;

public interface CharacterRepository {
    Character save(Character character);
    Optional<Character> findOwnedById(Long characterId, String ownerId);
    Optional<Character> findOwnedByIdForUpdate(Long characterId, String ownerId);
}
