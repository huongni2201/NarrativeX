package com.narrativex.backend.feature.assets.application.query;

import java.time.Instant;
import java.util.UUID;

public record MediaAssetView(
    UUID id,
    String type,
    String origin,
    String storageKey,
    String originalFilename,
    String contentType,
    long sizeBytes,
    String sha256,
    Long durationMs,
    String status,
    Instant createdAt,
    String detectedContentType,
    String detectedContainer,
    String detectedCodec,
    Integer width,
    Integer height,
    String validationErrorCode,
    String validationErrorDetail,
    Instant validatedAt) {
  public MediaAssetView(
      UUID id,
      String type,
      String origin,
      String storageKey,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      Long durationMs,
      String status,
      Instant createdAt) {
    this(id, type, origin, storageKey, originalFilename, contentType, sizeBytes, sha256,
        durationMs, status, createdAt, null, null, null, null, null, null, null, null);
  }
}
