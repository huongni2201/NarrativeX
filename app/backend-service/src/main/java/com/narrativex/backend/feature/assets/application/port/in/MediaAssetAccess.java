package com.narrativex.backend.feature.assets.application.port.in;

import java.util.Optional;
import java.util.UUID;

public interface MediaAssetAccess {
  Optional<MediaAssetSummary> findOwnedSummary(String ownerId, UUID assetId);

  record MediaAssetSummary(
      UUID id, String type, String status, String contentType, String detectedContentType) {}
}
