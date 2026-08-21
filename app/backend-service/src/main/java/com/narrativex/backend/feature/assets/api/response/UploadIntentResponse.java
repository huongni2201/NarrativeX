package com.narrativex.backend.feature.assets.api.response;

import com.narrativex.backend.feature.assets.application.query.UploadIntentView;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record UploadIntentResponse(
    UUID id,
    String type,
    String originalFilename,
    String contentType,
    long expectedSizeBytes,
    String expectedSha256,
    String storageKey,
    String uploadUrl,
    Map<String, String> uploadHeaders,
    String status,
    Instant expiresAt) {
  public static UploadIntentResponse from(UploadIntentView view) {
    return new UploadIntentResponse(
        view.id(),
        view.type(),
        view.originalFilename(),
        view.contentType(),
        view.expectedSizeBytes(),
        view.expectedSha256(),
        view.storageKey(),
        view.uploadUrl(),
        view.uploadHeaders(),
        view.status(),
        view.expiresAt());
  }
}
