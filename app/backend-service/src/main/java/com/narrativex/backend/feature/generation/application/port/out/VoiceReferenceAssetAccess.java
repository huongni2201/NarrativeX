package com.narrativex.backend.feature.generation.application.port.out;

import java.util.UUID;

public interface VoiceReferenceAssetAccess {
  VoiceReferenceAsset findOwned(String accountId, UUID id);

  record VoiceReferenceAsset(String contentType, String status, String storageKey) {}
}
