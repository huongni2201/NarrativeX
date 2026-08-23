package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.generation.application.query.JobHistoryView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record JobHistoryResponse(
    UUID jobId,
    UUID projectId,
    String projectName,
    String jobType,
    String status,
    int progress,
    String currentStep,
    String errorCode,
    Instant createdAt,
    Instant completedAt) {
  public static JobHistoryResponse from(JobHistoryView view) {
    return new JobHistoryResponse(
        view.jobId(),
        view.projectId(),
        view.projectName(),
        view.jobType(),
        view.status(),
        view.progress(),
        view.currentStep(),
        view.errorCode(),
        view.createdAt(),
        view.completedAt());
  }

  public record Page(
      List<JobHistoryResponse> content, String nextCursor, int limit, boolean hasNext) {
    public static Page from(CursorPage<JobHistoryView> page) {
      return new Page(
          page.content().stream().map(JobHistoryResponse::from).toList(),
          page.nextCursor(),
          page.limit(),
          page.hasNext());
    }
  }
}
