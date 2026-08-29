package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import com.narrativex.backend.feature.generation.domain.enums.VoiceReferenceScope;
import java.util.UUID;

public interface VoiceReferenceAssetAccess {
  VoiceReferenceAsset findOwned(
      String accountId, UUID projectId, VoiceReferenceSelection selection);

  record VoiceReferenceAsset(
      VoiceReferenceScope scope,
      UUID assetId,
      String contentType,
      String status,
      String storageKey,
      long sizeBytes,
      String sha256) {}
}
