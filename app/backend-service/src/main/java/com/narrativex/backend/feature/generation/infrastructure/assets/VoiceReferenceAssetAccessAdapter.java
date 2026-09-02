package com.narrativex.backend.feature.generation.infrastructure.assets;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import com.narrativex.backend.feature.generation.application.port.out.VoiceReferenceAssetAccess;
import com.narrativex.backend.feature.generation.domain.enums.VoiceReferenceScope;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VoiceReferenceAssetAccessAdapter implements VoiceReferenceAssetAccess {
  private final VoiceReferenceAssetRepository voiceReferenceAssetRepository;
  private final MediaAssetRepository mediaAssetRepository;

  @Override
  public VoiceReferenceAsset findOwned(
      String accountId, UUID projectId, VoiceReferenceSelection selection) {
    if (selection.scope() == VoiceReferenceScope.PROJECT) {
      var asset = mediaAssetRepository.findOwned(accountId, projectId, selection.assetId());
      if (!"AUDIO".equals(asset.type())) {
        throw new ResourceNotFoundException("Project voice reference asset not found");
      }
      return new VoiceReferenceAsset(
          VoiceReferenceScope.PROJECT,
          asset.id(),
          asset.contentType(),
          asset.status(),
          null,
          asset.sizeBytes(),
          asset.sha256());
    }

    var asset =
        voiceReferenceAssetRepository
            .findOwned(accountId, selection.assetId())
            .orElseThrow(
                () -> new ResourceNotFoundException("Account voice reference asset not found"));
    return new VoiceReferenceAsset(
        VoiceReferenceScope.ACCOUNT,
        asset.id(),
        asset.contentType(),
        asset.status(),
        asset.storageKey(),
        asset.sizeBytes(),
        asset.sha256());
  }
}
