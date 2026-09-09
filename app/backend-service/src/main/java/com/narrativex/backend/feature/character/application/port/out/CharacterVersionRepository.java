package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import java.util.Optional;
import java.util.UUID;

public interface CharacterVersionRepository {
  int findMaxVersionNumberByCharacterId(UUID characterId);

  Optional<CharacterVersion> findOwnedById(UUID characterVersionId, String ownerId);

  /** Locks only the owned character-version row for reference/status serialization. */
  Optional<CharacterVersion> findOwnedByIdForUpdate(UUID characterVersionId, String ownerId);

  CharacterVersion save(CharacterVersion characterVersion);
}
