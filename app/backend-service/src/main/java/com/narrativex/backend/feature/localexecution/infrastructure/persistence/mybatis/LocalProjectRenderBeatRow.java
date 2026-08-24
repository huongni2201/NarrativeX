package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.util.UUID;

public record LocalProjectRenderBeatRow(
    UUID chapterId,
    int sceneIndex,
    int beatIndex,
    UUID visualBeatId,
    long globalStartMs,
    long globalEndMs,
    long durationMs,
    String cameraMovement,
    String storageKey,
    long sizeBytes,
    String checksum) {}
