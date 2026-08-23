package com.narrativex.backend.feature.render.application.query;

import java.time.Instant;
import java.util.UUID;

public record FinalArtifactView(
    Long id,
    UUID projectId,
    UUID chapterId,
    String artifactType,
    String renderFingerprint,
    String storageKey,
    String storageProvider,
    String externalFileId,
    String webViewLink,
    String mimeType,
    Long sizeBytes,
    String checksumSha256,
    Long durationMs,
    Integer width,
    Integer height,
    String status,
    Instant createdAt,
    Instant updatedAt) {}
