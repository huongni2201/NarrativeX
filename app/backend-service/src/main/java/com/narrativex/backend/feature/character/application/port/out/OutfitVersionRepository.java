package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import java.util.Optional;

public interface OutfitVersionRepository {
  int findMaxVersionNumberByCharacterId(Long characterId);

  Optional<OutfitVersion> findOwnedById(Long outfitVersionId, String ownerId);

  OutfitVersion save(OutfitVersion outfitVersion);
}
