package com.narrativex.backend.feature.project.api.response;

public record ProjectOverviewMetricsResponse(
    int totalChapters,
    int readyChapters,
    int renderedChapters,
    int totalScenes,
    long estimatedDurationSeconds,
    int approvedVisuals,
    int processingJobs,
    int overallProgress) {}
