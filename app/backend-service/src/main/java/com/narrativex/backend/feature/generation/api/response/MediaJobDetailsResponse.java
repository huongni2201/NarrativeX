package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import java.util.List;
import java.util.UUID;

public record MediaJobDetailsResponse(
    String jobId,
    UUID mediaPlanId,
    Integer mediaPlanRevision,
    int totalItems,
    long readyItems,
    long reviewItems,
    List<Item> items) {
  public static MediaJobDetailsResponse from(GenerationJob job, List<MediaGenerationItem> items) {
    return new MediaJobDetailsResponse(
        job.getJobId(), job.getMediaPlanId(), job.getMediaPlanRevision(), items.size(),
        items.stream().filter(item -> item.getExecutionStatus().name().equals("READY")).count(),
        items.stream().filter(item -> item.getReviewStatus().name().equals("NEEDS_REVIEW")).count(),
        items.stream().map(Item::from).toList());
  }

  public record Item(
      UUID id,
      Long visualBeatId,
      String itemKey,
      String executionStatus,
      String reviewStatus,
      int attemptNumber,
      UUID mediaAssetId,
      String errorCode,
      long rowVersion) {
    static Item from(MediaGenerationItem item) {
      return new Item(item.getId(), item.getVisualBeatId(), item.getItemKey(), item.getExecutionStatus().name(), item.getReviewStatus().name(), item.getAttemptNumber(), item.getMediaAssetId(), item.getErrorCode(), item.getRowVersion());
    }
  }
}
