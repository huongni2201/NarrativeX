package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.time.Instant;
import java.util.UUID;

public record TakeResponse(
    UUID id,
    UUID shotId,
    int attemptNumber,
    String provider,
    String model,
    GenerationStrategy generationMode,
    UUID outputAssetId,
    Long sourceDurationMs,
    String metricsJson,
    String validationStatus,
    VideoQAFailureCategory validationFailureCategory,
    String validationFailureReason,
    String validationRetryRecommendation,
    String status,
    Instant createdAt,
    UUID jobId) {
  @com.fasterxml.jackson.annotation.JsonProperty("generationJobId")
  public UUID generationJobId() {
    return jobId;
  }
}
