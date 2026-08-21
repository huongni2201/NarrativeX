package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import java.time.Instant;

public record ProjectDashboardRow(
    Long id,
    String name,
    String description,
    String coverImageUrl,
    String status,
    Instant createdAt,
    Instant updatedAt,
    boolean starred,
    int totalChapters,
    int totalScenes,
    long estimatedDurationSeconds) {}
