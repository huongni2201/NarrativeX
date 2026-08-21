package com.narrativex.backend.feature.assets.application.port.out;

import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import java.util.List;
import java.util.UUID;

public interface MediaAssetRepository {
  List<MediaAssetView> list(String accountId, String type, String status, String search);

  MediaAssetView create(String accountId, CreateMediaAsset command);

  MediaAssetView approve(String accountId, UUID id);

  void delete(String accountId, UUID id);

  record CreateMediaAsset(
      UUID id,
      String type,
      String origin,
      String storageKey,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      Long durationMs) {}
}
