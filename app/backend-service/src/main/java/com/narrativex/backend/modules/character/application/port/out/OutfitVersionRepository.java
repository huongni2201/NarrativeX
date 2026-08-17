package com.narrativex.backend.modules.character.application.port.out;

import com.narrativex.backend.modules.character.domain.entity.OutfitVersion;
import java.util.Optional;

public interface OutfitVersionRepository {
    int findMaxVersionNumberByCharacterId(Long characterId);
    Optional<OutfitVersion> findOwnedById(Long outfitVersionId, String ownerId);
    OutfitVersion save(OutfitVersion outfitVersion);
}
