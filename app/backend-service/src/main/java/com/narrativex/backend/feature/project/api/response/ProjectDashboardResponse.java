package com.narrativex.backend.feature.project.api.response;

import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardCountsRow;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardRow;
import java.time.Instant;
import java.util.List;

public record ProjectDashboardResponse(
    List<ProjectDashboardItem> content,
    String nextCursor,
    int limit,
    boolean hasNext,
    ProjectDashboardCounts counts) {

  public ProjectDashboardResponse {
    content = List.copyOf(content);
  }

  public static ProjectDashboardItem item(ProjectDashboardRow row) {
    return new ProjectDashboardItem(
        row.id(),
        row.name(),
        row.description(),
        row.coverImageUrl(),
        row.status(),
        row.createdAt(),
        row.updatedAt(),
        row.starred(),
        new ProjectDashboardMetrics(
            row.totalChapters(), row.totalScenes(), row.estimatedDurationSeconds()));
  }

  public static ProjectDashboardCounts counts(ProjectDashboardCountsRow row) {
    return new ProjectDashboardCounts(row.allCount(), row.activeCount(), row.draftCount());
  }

  public record ProjectDashboardItem(
      Long id,
      String name,
      String description,
      String coverImageUrl,
      String status,
      Instant createdAt,
      Instant updatedAt,
      boolean isStarred,
      ProjectDashboardMetrics metrics) {}

  public record ProjectDashboardMetrics(
      int totalChapters, int totalScenes, long estimatedDurationSeconds) {}

  public record ProjectDashboardCounts(long all, long active, long draft) {}
}
