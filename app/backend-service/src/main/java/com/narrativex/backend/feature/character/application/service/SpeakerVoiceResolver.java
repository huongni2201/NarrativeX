package com.narrativex.backend.feature.character.application.service;

import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVoiceProfileRepository;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import com.narrativex.backend.feature.character.domain.enums.CharacterVoiceProfileStatus;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Resolves the voice identity and reference audio asset for a speaker ProjectCharacter. Follows the
 * resolution hierarchy: speakerProjectCharacterId -> ProjectCharacter -> Character -> pinned
 * CharacterVoiceProfile -> reference audio asset.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpeakerVoiceResolver {
  private final ProjectCharacterRepository projectCharacterRepository;
  private final CharacterRepository characterRepository;
  private final CharacterVoiceProfileRepository voiceProfileRepository;

  public record ResolvedSpeakerVoice(
      UUID characterId,
      String characterName,
      UUID voiceProfileId,
      UUID referenceAssetId,
      VoiceReferenceScope referenceScope,
      String language,
      String accent,
      String voiceDescription,
      String deliveryBaseline) {}

  public Optional<ResolvedSpeakerVoice> resolveSpeakerVoice(UUID speakerProjectCharacterId) {
    if (speakerProjectCharacterId == null) {
      return Optional.empty();
    }

    Optional<ProjectCharacter> pcOpt =
        projectCharacterRepository.findById(speakerProjectCharacterId);
    if (pcOpt.isEmpty()) {
      log.debug("ProjectCharacter {} not found for voice resolution", speakerProjectCharacterId);
      return Optional.empty();
    }
    ProjectCharacter pc = pcOpt.get();

    Optional<Character> characterOpt = characterRepository.findById(pc.getCharacterId());
    if (characterOpt.isEmpty()) {
      log.debug("Character {} not found for voice resolution", pc.getCharacterId());
      return Optional.empty();
    }
    Character character = characterOpt.get();

    // 1. Check pinned profile on Character
    UUID profileId = character.getPinnedVoiceProfileId();
    Optional<CharacterVoiceProfile> profileOpt = Optional.empty();

    if (profileId != null) {
      profileOpt = voiceProfileRepository.findById(profileId);
    }

    // 2. Fallback to latest active profile for Character if none pinned
    if (profileOpt.isEmpty()) {
      profileOpt = voiceProfileRepository.findPinnedByCharacterId(character.getId());
      if (profileOpt.isEmpty()) {
        profileOpt =
            voiceProfileRepository.findByCharacterId(character.getId()).stream()
                .filter(p -> p.getStatus() == CharacterVoiceProfileStatus.ACTIVE)
                .findFirst();
      }
    }

    if (profileOpt.isEmpty()) {
      log.debug("No active voice profile found for character {}", character.getId());
      return Optional.empty();
    }

    CharacterVoiceProfile profile = profileOpt.get();
    return Optional.of(
        new ResolvedSpeakerVoice(
            character.getId(),
            character.getCanonicalName(),
            profile.getId(),
            profile.getReferenceAssetId(),
            profile.getReferenceScope(),
            profile.getLanguage(),
            profile.getAccent(),
            profile.getVoiceDescription(),
            profile.getDeliveryBaseline()));
  }
}
