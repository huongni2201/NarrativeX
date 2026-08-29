package com.narrativex.backend.feature.generation.infrastructure.assets;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.VoiceReferenceAssetAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VoiceReferenceAssetAccessAdapter implements VoiceReferenceAssetAccess {
  private final VoiceReferenceAssetRepository voiceReferenceAssetRepository;

  @Override
  public VoiceReferenceAsset findOwned(String accountId, UUID id) {
    var asset =
        voiceReferenceAssetRepository
            .findOwned(accountId, id)
            .orElseThrow(() -> new ResourceNotFoundException("Voice reference asset not found"));
    return new VoiceReferenceAsset(asset.contentType(), asset.status(), asset.storageKey());
  }
}
