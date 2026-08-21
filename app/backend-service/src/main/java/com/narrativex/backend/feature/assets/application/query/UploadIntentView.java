package com.narrativex.backend.feature.assets.application.query;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record UploadIntentView(
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
    Instant expiresAt) {}
