package com.narrativex.backend.feature.assets.application.port.out;

import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.UUID;

/** Persistence boundary for project-owned media only. */
public interface MediaAssetRepository {
  CursorPage<MediaAssetView> list(
      String accountId,
      UUID projectId,
      String type,
      String status,
      String search,
      String cursor,
      int limit);

  MediaAssetView createLocalAsset(String accountId, CreateLocalMediaAsset command);

  MediaAssetView findOwned(String accountId, UUID projectId, UUID id);

  void delete(String accountId, UUID projectId, UUID id);

  record CreateLocalMediaAsset(
      UUID proposedId,
      UUID projectId,
      String type,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      Long durationMs) {}
}
