package com.narrativex.backend.feature.project.application.query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Persistence-neutral projection for the project dashboard. */
public record ProjectDashboardView(
    List<Item> content, String nextCursor, int limit, boolean hasNext, Counts counts) {
  public record Item(
      UUID id,
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

  public record Counts(long all, long active, long draft) {}
}
