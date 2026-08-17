package com.narrativex.backend.modules.character.application.port.out;

import com.narrativex.backend.modules.character.domain.aggregate.CharacterVersion;
import java.util.Optional;

public interface CharacterVersionRepository {
    int findMaxVersionNumberByCharacterId(Long characterId);
    Optional<CharacterVersion> findOwnedById(Long characterVersionId, String ownerId);
    CharacterVersion save(CharacterVersion characterVersion);
}
