package com.narrativex.backend.feature.project.api.response;

import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Read model tailored to the Project Overview screen. */
public record ProjectOverviewResponse(
    UUID id,
    String name,
    String description,
    String coverImageUrl,
    String status,
    Instant createdAt,
    Instant updatedAt,
    ProjectOverviewMetricsResponse metrics,
    ProjectOverviewCountsResponse counts,
    List<ProjectOverviewChapterResponse> chapters) {

  public static ProjectOverviewResponse from(ProjectOverviewView view) {
    var metrics = view.metrics();
    var counts = view.counts();
    return new ProjectOverviewResponse(
        view.id(),
        view.name(),
        view.description(),
        view.coverImageUrl(),
        view.status(),
        view.createdAt(),
        view.updatedAt(),
        new ProjectOverviewMetricsResponse(
            metrics.totalChapters(),
            metrics.readyChapters(),
            metrics.renderedChapters(),
            metrics.totalScenes(),
            metrics.estimatedDurationSeconds(),
            metrics.approvedVisuals(),
            metrics.processingJobs(),
            metrics.overallProgress()),
        new ProjectOverviewCountsResponse(counts.characters(), counts.locations(), counts.assets()),
        view.chapters().stream()
            .map(
                chapter ->
                    new ProjectOverviewChapterResponse(
                        chapter.id(),
                        chapter.orderIndex(),
                        chapter.title(),
                        chapter.status(),
                        chapter.sceneCount(),
                        chapter.durationSeconds(),
                        chapter.updatedAt()))
            .toList());
  }
}
