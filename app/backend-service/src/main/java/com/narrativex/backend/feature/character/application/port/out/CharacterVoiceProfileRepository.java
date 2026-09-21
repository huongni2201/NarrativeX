package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CharacterVoiceProfileRepository {
  CharacterVoiceProfile save(CharacterVoiceProfile profile);

  Optional<CharacterVoiceProfile> findById(UUID id);

  Optional<CharacterVoiceProfile> findPinnedByCharacterId(UUID characterId);

  List<CharacterVoiceProfile> findByCharacterId(UUID characterId);

  int nextVersionNumber(UUID characterId);
}
