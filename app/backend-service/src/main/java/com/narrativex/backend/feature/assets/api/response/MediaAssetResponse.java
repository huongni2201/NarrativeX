package com.narrativex.backend.feature.assets.api.response;

import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import java.time.Instant;
import java.util.List;
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
    Instant createdAt,
    String detectedContentType,
    String detectedContainer,
    String detectedCodec,
    Integer width,
    Integer height,
    String validationErrorCode,
    String validationErrorDetail,
    Instant validatedAt,
    String storageMode) {
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
        view.createdAt(),
        view.detectedContentType(),
        view.detectedContainer(),
        view.detectedCodec(),
        view.width(),
        view.height(),
        view.validationErrorCode(),
        view.validationErrorDetail(),
        view.validatedAt(),
        view.storageMode());
  }

  public record Page(List<MediaAssetResponse> items, String nextCursor) {
    public static Page from(
        com.narrativex.backend.feature.common.pagination.CursorPage<MediaAssetView> page) {
      return new Page(
          page.content().stream().map(MediaAssetResponse::from).toList(), page.nextCursor());
    }
  }
}
