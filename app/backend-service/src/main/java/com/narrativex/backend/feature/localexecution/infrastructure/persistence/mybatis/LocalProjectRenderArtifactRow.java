package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

public record LocalProjectRenderArtifactRow(
    String renderFingerprint,
    String storageKey,
    String storageProvider,
    String externalFileId,
    String webViewLink,
    String mimeType,
    long sizeBytes,
    String checksumSha256,
    long durationMs,
    int width,
    int height,
    int fps) {}
