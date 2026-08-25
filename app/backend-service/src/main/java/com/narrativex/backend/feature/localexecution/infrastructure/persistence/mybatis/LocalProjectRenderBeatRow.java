package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.util.UUID;

public record LocalProjectRenderBeatRow(
    UUID chapterId,
    int sceneIndex,
    int beatIndex,
    UUID visualBeatId,
    UUID mediaAssetId,
    long globalStartMs,
    long globalEndMs,
    long durationMs,
    String cameraMovement,
    String mediaType,
    String storageMode,
    Long sourceDurationMs,
    String fitMode,
    long trimStartMs,
    String storageKey,
    long sizeBytes,
    String checksum) {}
