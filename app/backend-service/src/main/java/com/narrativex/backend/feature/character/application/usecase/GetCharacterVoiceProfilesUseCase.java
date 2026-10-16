package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVoiceProfileRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetCharacterVoiceProfilesUseCase {
  private final CharacterRepository characters;
  private final CharacterVoiceProfileRepository profiles;

  @Transactional(readOnly = true)
  public State execute(UUID characterId) {
    var character =
        characters
            .findById(characterId)
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
    return new State(
        character.getRowVersion(),
        character.getPinnedVoiceProfileId(),
        profiles.findByCharacterId(characterId));
  }

  public record State(
      long characterRowVersion, UUID pinnedVoiceProfileId, List<CharacterVoiceProfile> profiles) {}
}
