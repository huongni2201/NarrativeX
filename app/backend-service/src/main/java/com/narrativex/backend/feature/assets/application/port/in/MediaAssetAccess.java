package com.narrativex.backend.feature.assets.application.port.in;

import java.util.Optional;
import java.util.UUID;

public interface MediaAssetAccess {
  Optional<MediaAssetSummary> findSummary(UUID assetId);

  record MediaAssetSummary(
      UUID id, String type, String status, String contentType, String detectedContentType) {}
}
