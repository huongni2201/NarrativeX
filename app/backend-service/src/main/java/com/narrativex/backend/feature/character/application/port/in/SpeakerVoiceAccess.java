package com.narrativex.backend.feature.character.application.port.in;

import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import java.util.Optional;
import java.util.UUID;

public interface SpeakerVoiceAccess {
  Optional<ResolvedSpeakerVoice> resolveSpeakerVoice(UUID speakerProjectCharacterId);

  record ResolvedSpeakerVoice(
      UUID characterId,
      String characterName,
      UUID voiceProfileId,
      UUID referenceAssetId,
      VoiceReferenceScope referenceScope,
      String language,
      String accent,
      String voiceDescription,
      String deliveryBaseline) {}
}
