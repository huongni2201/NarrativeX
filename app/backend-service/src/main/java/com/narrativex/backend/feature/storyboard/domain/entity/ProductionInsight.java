package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Post-publish audience retention observations and actionable recommendations for continuous
 * narrative tuning according to ADR-0031.
 */
public record ProductionInsight(
    UUID id,
    long rowVersion,
    Instant createdAt,
    UUID projectId,
    UUID chapterId,
    String observationJson,
    String recommendationText,
    String status) {

  public ProductionInsight {
    Objects.requireNonNull(id, "id must not be null");
    Objects.requireNonNull(projectId, "projectId must not be null");
    if (observationJson == null) {
      observationJson = "{}";
    }
    if (recommendationText == null) {
      recommendationText = "";
    }
    if (status == null || status.isBlank()) {
      status = "PENDING_REVIEW";
    }
  }

  public static ProductionInsight create(
      UUID projectId, UUID chapterId, String observationJson, String recommendationText) {
    return new ProductionInsight(
        UuidV7.random(),
        0L,
        Instant.now(),
        projectId,
        chapterId,
        observationJson,
        recommendationText,
        "PENDING_REVIEW");
  }
}
