package com.narrativex.backend.feature.render.application.query;

import java.time.Instant;

public record FinalArtifactView(
    Long id,
    Long projectId,
    Long chapterId,
    String artifactType,
    String renderFingerprint,
    String storageKey,
    String mimeType,
    Long sizeBytes,
    String checksumSha256,
    Long durationMs,
    Integer width,
    Integer height,
    String status,
    Instant createdAt,
    Instant updatedAt) {}
