package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import java.util.Optional;
import java.util.UUID;

public interface CharacterVersionRepository {
  int findMaxVersionNumberByCharacterId(UUID characterId);

  Optional<CharacterVersion> findById(UUID characterVersionId);

  Optional<CharacterVersion> findByIdForUpdate(UUID characterVersionId);

  CharacterVersion save(CharacterVersion characterVersion);
}
