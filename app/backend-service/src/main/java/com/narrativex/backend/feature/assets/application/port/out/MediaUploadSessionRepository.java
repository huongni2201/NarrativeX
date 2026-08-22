package com.narrativex.backend.feature.assets.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MediaUploadSessionRepository {
  UploadSession create(CreateUploadSession command);

  Optional<UploadSession> findOwnedSnapshot(String accountId, UUID id);

  Optional<UploadSession> findOwnedForUpdate(String accountId, UUID id);

  Optional<UploadSession> findByIdempotencyKey(String accountId, String idempotencyKey);

  boolean markReady(String accountId, UUID id, UUID mediaAssetId);

  boolean markRejected(String accountId, UUID id);

  List<ExpiredUpload> findExpiredPending(int limit);

  record ExpiredUpload(UUID id, String accountId, String storageKey) {}

  record CreateUploadSession(
      UUID id,
      String accountId,
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
