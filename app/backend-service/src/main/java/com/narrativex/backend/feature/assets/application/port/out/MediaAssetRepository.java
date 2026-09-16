package com.narrativex.backend.feature.assets.application.port.out;

import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.UUID;

/** Persistence boundary for project-owned media only. */
public interface MediaAssetRepository {
  CursorPage<MediaAssetView> list(
      UUID projectId, String type, String status, String search, String cursor, int limit);

  MediaAssetView createLocalAsset(CreateLocalMediaAsset command);

  MediaAssetView createGeneratedAsset(CreateGeneratedMediaAsset command);

  MediaAssetView findById(UUID projectId, UUID id);

  void delete(UUID projectId, UUID id);

  record CreateLocalMediaAsset(
      UUID proposedId,
      UUID projectId,
      String type,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      Long durationMs) {}

  record CreateGeneratedMediaAsset(
      UUID proposedId,
      UUID projectId,
      String type,
      String origin,
      String storageKey,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      Long durationMs) {}
}
