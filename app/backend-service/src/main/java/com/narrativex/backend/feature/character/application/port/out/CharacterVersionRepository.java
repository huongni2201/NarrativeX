package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import java.util.Optional;

public interface CharacterVersionRepository {
    int findMaxVersionNumberByCharacterId(Long characterId);
    Optional<CharacterVersion> findOwnedById(Long characterVersionId, String ownerId);
    CharacterVersion save(CharacterVersion characterVersion);
}
