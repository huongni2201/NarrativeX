package com.narrativex.backend.feature.generation.domain.value;

import com.narrativex.backend.feature.generation.domain.enums.MediaAssetOrigin;
import com.narrativex.backend.feature.generation.domain.enums.MediaAssetStatus;
import com.narrativex.backend.feature.generation.domain.enums.MediaAssetType;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Immutable metadata for a binary object stored in the configured durable media store. */
public record MediaAsset(
    UUID id,
    MediaAssetType type,
    MediaAssetOrigin origin,
    String storageKey,
    String originalFilename,
    String contentType,
    long sizeBytes,
    String sha256,
    Long durationMs,
    MediaAssetStatus status,
    Instant createdAt) {
  public MediaAsset {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(type, "type");
    Objects.requireNonNull(origin, "origin");
    requireText(storageKey, "storageKey");
    requireText(originalFilename, "originalFilename");
    requireText(contentType, "contentType");
    if (sizeBytes <= 0) throw new IllegalArgumentException("sizeBytes must be positive");
    if (sha256 == null || !sha256.matches("^[0-9a-f]{64}$")) {
      throw new IllegalArgumentException("sha256 must be lowercase sha256 hex");
    }
    if (durationMs != null && durationMs <= 0) {
      throw new IllegalArgumentException("durationMs must be positive when present");
    }
    Objects.requireNonNull(status, "status");
    Objects.requireNonNull(createdAt, "createdAt");
  }

  public void requireReadyAudio() {
    if (type != MediaAssetType.AUDIO) throw new IllegalStateException("Asset is not audio");
    if (status != MediaAssetStatus.READY) {
      throw new IllegalStateException("Audio asset is not READY: " + status);
    }
    if (durationMs == null) throw new IllegalStateException("READY audio must have durationMs");
  }

  private static void requireText(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
  }
}
