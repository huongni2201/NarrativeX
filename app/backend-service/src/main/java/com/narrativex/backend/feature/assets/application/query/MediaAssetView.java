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
    Instant createdAt) {}
