package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import java.util.Optional;
import java.util.UUID;

public interface OutfitVersionRepository {
  int findMaxVersionNumberByCharacterId(UUID characterId);

  Optional<OutfitVersion> findOwnedById(UUID outfitVersionId, String ownerId);

  OutfitVersion save(OutfitVersion outfitVersion);
}
