package com.narrativex.backend.feature.generation.application.query;

import java.util.UUID;

public record ProjectRenderArtifactView(
    UUID id,
    UUID projectId,
    UUID generationJobId,
    String webViewLink,
    String mimeType,
    long sizeBytes,
    String checksumSha256,
    long durationMs,
    int width,
    int height,
    int fps,
    String status) {}
