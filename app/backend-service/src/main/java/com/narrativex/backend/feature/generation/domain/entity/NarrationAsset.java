package com.narrativex.backend.feature.generation.domain.entity;

import java.util.Objects;
import java.util.UUID;

/** Immutable narration metadata. The bytes live behind project_assets/storage_key. */
public record NarrationAsset(
    UUID id,
    UUID narrationRequestId,
    Long projectAssetId,
    long durationMs,
    long sizeBytes,
    String codec,
    int sampleRateHz,
    int channels,
    String checksum) {
  public NarrationAsset {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(narrationRequestId, "narrationRequestId");
    if (projectAssetId == null || projectAssetId <= 0) throw new IllegalArgumentException("projectAssetId must be positive");
    if (durationMs <= 0) throw new IllegalArgumentException("durationMs must be positive");
    if (sizeBytes <= 0) throw new IllegalArgumentException("sizeBytes must be positive");
    if (sampleRateHz <= 0) throw new IllegalArgumentException("sampleRateHz must be positive");
    if (channels <= 0) throw new IllegalArgumentException("channels must be positive");
    if (codec == null || codec.isBlank()) throw new IllegalArgumentException("codec must not be blank");
    if (checksum == null || !checksum.matches("^[0-9a-f]{64}$"))
      throw new IllegalArgumentException("checksum must be sha256 hex");
  }
}
