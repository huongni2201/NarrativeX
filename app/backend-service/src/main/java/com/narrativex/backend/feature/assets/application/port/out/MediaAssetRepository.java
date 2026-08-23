package com.narrativex.backend.feature.assets.application.port.out;

import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.UUID;

public interface MediaAssetRepository {
  CursorPage<MediaAssetView> list(
      String accountId, String type, String status, String search, String cursor, int limit);

  MediaAssetView createOrReuseVerifiedAsset(String accountId, CreateVerifiedMediaAsset command);

  MediaAssetView findOwned(String accountId, UUID id);

  MediaAssetView findVerifiedByChecksum(String accountId, String sha256);

  boolean isReferencedByReadyAsset(String storageKey);

  MediaAssetView startUpload(String accountId, UUID id);

  MediaAssetView startValidation(String accountId, UUID id);

  MediaAssetView approve(String accountId, UUID id);

  MediaAssetView reject(String accountId, UUID id);

  void delete(String accountId, UUID id);

  record CreateVerifiedMediaAsset(
      UUID proposedId,
      String type,
      String origin,
      String storageKey,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      Long durationMs) {}
}
