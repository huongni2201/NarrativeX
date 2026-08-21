package com.narrativex.backend.feature.assets.api.response;

import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import java.time.Instant;
import java.util.UUID;

public record MediaAssetResponse(
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
  public static MediaAssetResponse from(MediaAssetView view) {
    return new MediaAssetResponse(
        view.id(),
        view.type(),
        view.origin(),
        view.storageKey(),
        view.originalFilename(),
        view.contentType(),
        view.sizeBytes(),
        view.sha256(),
        view.durationMs(),
        view.status(),
        view.createdAt());
  }
}
