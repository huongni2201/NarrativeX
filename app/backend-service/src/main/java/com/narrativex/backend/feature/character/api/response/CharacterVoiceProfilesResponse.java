package com.narrativex.backend.feature.character.api.response;

import com.narrativex.backend.feature.character.application.usecase.GetCharacterVoiceProfilesUseCase;
import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CharacterVoiceProfilesResponse(
    long characterRowVersion, UUID pinnedVoiceProfileId, List<Profile> profiles) {
  public static CharacterVoiceProfilesResponse from(GetCharacterVoiceProfilesUseCase.State state) {
    return new CharacterVoiceProfilesResponse(
        state.characterRowVersion(),
        state.pinnedVoiceProfileId(),
        state.profiles().stream().map(Profile::from).toList());
  }

  public record Profile(
      UUID id,
      UUID characterId,
      int versionNumber,
      UUID referenceAssetId,
      String referenceScope,
      String language,
      String accent,
      String voiceDescription,
      String deliveryBaseline,
      String status,
      Instant lockedAt) {
    public static Profile from(CharacterVoiceProfile profile) {
      return new Profile(
          profile.getId(),
          profile.getCharacterId(),
          profile.getVersionNumber(),
          profile.getReferenceAssetId(),
          profile.getReferenceScope().name(),
          profile.getLanguage(),
          profile.getAccent(),
          profile.getVoiceDescription(),
          profile.getDeliveryBaseline(),
          profile.getStatus().name(),
          profile.getLockedAt());
    }
  }
}
