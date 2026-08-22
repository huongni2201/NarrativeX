package com.narrativex.backend.feature.generation.infrastructure.assets;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.generation.application.port.out.VoiceReferenceAssetAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VoiceReferenceAssetAccessAdapter implements VoiceReferenceAssetAccess {
  private final MediaAssetRepository mediaAssetRepository;

  @Override
  public VoiceReferenceAsset findOwned(String accountId, UUID id) {
    var asset = mediaAssetRepository.findOwned(accountId, id);
    return new VoiceReferenceAsset(asset.type(), asset.contentType(), asset.status());
  }
}
