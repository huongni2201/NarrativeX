package com.narrativex.backend.feature.assets.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MediaUploadSessionRepository {
  UploadSession create(CreateUploadSession command);

  Optional<UploadSession> findSnapshot(UUID id);

  Optional<UploadSession> findForUpdate(UUID id);

  Optional<UploadSession> findByIdempotencyKey(String idempotencyKey);

  boolean markValidating(UUID id, UUID mediaAssetId);

  boolean markReady(UUID id, UUID mediaAssetId);

  boolean markRejected(UUID id);

  List<ExpiredUpload> findExpiredPending(int limit);

  List<RejectedUpload> findRejectedForCleanup(int limit);

  record ExpiredUpload(UUID id, String storageKey) {}

  record RejectedUpload(UUID id, String storageKey) {}

  record CreateUploadSession(
      UUID id,
      String assetType,
      String originalFilename,
      String contentType,
      long expectedSize,
      String expectedSha256,
      String storageKey,
      String idempotencyKey,
      Instant expiresAt) {}

  record UploadSession(
      UUID id,
      String assetType,
      String originalFilename,
      String contentType,
      long expectedSize,
      String expectedSha256,
      String storageKey,
      String idempotencyKey,
      String status,
      Instant expiresAt,
      Instant createdAt,
      UUID mediaAssetId) {}
}
