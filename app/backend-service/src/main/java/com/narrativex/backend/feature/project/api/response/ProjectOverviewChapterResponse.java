package com.narrativex.backend.feature.project.api.response;

import java.time.Instant;

public record ProjectOverviewChapterResponse(
    Long id,
    int orderIndex,
    String title,
    String status,
    int sceneCount,
    long durationSeconds,
    Instant updatedAt) {}
