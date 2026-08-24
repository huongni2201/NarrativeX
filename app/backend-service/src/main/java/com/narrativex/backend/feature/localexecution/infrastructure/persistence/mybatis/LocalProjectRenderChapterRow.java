package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.util.UUID;

public record LocalProjectRenderChapterRow(
    UUID chapterId,
    int orderIndex,
    long globalStartMs,
    long globalEndMs,
    String storageKey,
    long sizeBytes,
    String checksum,
    long durationMs) {}
