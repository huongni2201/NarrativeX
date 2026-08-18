package com.narrativex.backend.feature.project.api.response;

import java.time.Instant;
import java.util.List;

/** Read model tailored to the Project Overview screen. */
public record ProjectOverviewResponse(
    Long id,
    String name,
    String description,
    String coverImageUrl,
    String status,
    Instant createdAt,
    Instant updatedAt,
    ProjectOverviewMetricsResponse metrics,
    ProjectOverviewCountsResponse counts,
    List<ProjectOverviewChapterResponse> chapters) {}
