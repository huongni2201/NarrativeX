package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import java.util.UUID;

public interface VoiceReferenceAssetAccess {
  VoiceReferenceAsset find(UUID projectId, VoiceReferenceSelection selection);

  record VoiceReferenceAsset(
      VoiceReferenceScope scope,
      UUID assetId,
      String contentType,
      String status,
      String storageKey,
      long sizeBytes,
      String sha256) {}
}
