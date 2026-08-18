package com.narrativex.backend.feature.project.application.query;

import java.time.Instant;
import java.util.List;

/** Projection returned by the persistence query for the Project Overview screen. */
public record ProjectOverviewView(
    Long id,
    String name,
    String description,
    String coverImageUrl,
    String status,
    Instant createdAt,
    Instant updatedAt,
    Metrics metrics,
    Counts counts,
    List<Chapter> chapters) {

  public record Metrics(
      int totalChapters,
      int readyChapters,
      int renderedChapters,
      int totalScenes,
      long estimatedDurationSeconds,
      int approvedVisuals,
      int processingJobs,
      int overallProgress) {}

  public record Counts(int characters, int locations, int assets) {}

  public record Chapter(
      Long id,
      int orderIndex,
      String title,
      String status,
      int sceneCount,
      long durationSeconds,
      Instant updatedAt) {}
}
