package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.command.CreateCharacterVoiceProfileCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVoiceProfileRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateCharacterVoiceProfileUseCase {
  private final CharacterRepository characters;
  private final CharacterVoiceProfileRepository profiles;

  @Transactional
  public CharacterVoiceProfile execute(CreateCharacterVoiceProfileCommand command) {
    var character =
        characters
            .findByIdForUpdate(command.characterId())
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
    if (character.getRowVersion() != command.expectedRowVersion()) {
      throw new ResourceConflictException("Character changed; refresh before saving its voice");
    }
    if (command.voiceDescription() == null || command.voiceDescription().isBlank()) {
      throw new IllegalArgumentException("Voice description is required");
    }
    var profile =
        profiles.save(
            character.createVoiceProfile(
                profiles.nextVersionNumber(character.getId()),
                null,
                VoiceReferenceScope.GLOBAL_LOCAL,
                command.language(),
                command.accent(),
                command.voiceDescription().trim(),
                command.deliveryBaseline()));
    character.pinVoiceProfile(profile.getId());
    characters.save(character);
    return profile;
  }
}
