package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.VoiceReferenceAsset;
import java.util.UUID;

public record VoiceReferenceAssetResponse(
    UUID id,
    String originalFilename,
    String contentType,
    long sizeBytes,
    String sha256,
    String status) {
  public static VoiceReferenceAssetResponse from(VoiceReferenceAsset asset) {
    return new VoiceReferenceAssetResponse(
        asset.id(),
        asset.originalFilename(),
        asset.contentType(),
        asset.sizeBytes(),
        asset.sha256(),
        asset.status());
  }
}
