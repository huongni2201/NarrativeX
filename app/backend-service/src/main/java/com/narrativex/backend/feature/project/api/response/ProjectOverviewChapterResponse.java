package com.narrativex.backend.feature.project.api.response;

import java.time.Instant;
import java.util.UUID;

public record ProjectOverviewChapterResponse(
    UUID id,
    int orderIndex,
    String title,
    String status,
    int sceneCount,
    long durationSeconds,
    Instant updatedAt) {}
