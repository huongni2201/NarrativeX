package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.MediaScenePlan;
import com.narrativex.backend.feature.generation.domain.value.MediaWorkload;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable, versioned media execution plan. Once persisted it is never updated; a policy or
 * storyboard change produces a new revision instead.
 */
public record MediaPlan(
    UUID id,
    Long chapterId,
    long chapterRowVersion,
    String sourceHash,
    ProductionMode productionMode,
    int revision,
    List<MediaScenePlan> scenes,
    MediaWorkload workload,
    BigDecimal estimatedCost,
    Instant createdAt,
    Long storyboardRevisionId,
    String workflowVersion,
    String imageAspectRatio,
    String imageQualityTier,
    String imageProviderKey,
    String imageModelKey,
    String pricingSnapshotJson,
    String pricingFingerprint,
    String narrationSetId,
    String narrationAlignmentRunId) {

  public MediaPlan(
      UUID id,
      Long chapterId,
      long chapterRowVersion,
      String sourceHash,
      ProductionMode productionMode,
      int revision,
      List<MediaScenePlan> scenes,
      MediaWorkload workload,
      BigDecimal estimatedCost,
      Instant createdAt) {
    this(
        id,
        chapterId,
        chapterRowVersion,
        sourceHash,
        productionMode,
        revision,
        scenes,
        workload,
        estimatedCost,
        createdAt,
        null,
        "media-mvp-v1",
        "16:9",
        "STANDARD",
        null,
        null,
        null,
        null,
        null,
        null);
  }

  public MediaPlan {
    Objects.requireNonNull(id, "id");
    if (chapterId == null || chapterId <= 0) {
      throw new IllegalArgumentException("chapterId must be positive");
    }
    if (chapterRowVersion < 0) {
      throw new IllegalArgumentException("chapterRowVersion must not be negative");
    }
    sourceHash = required(sourceHash, "sourceHash");
    Objects.requireNonNull(productionMode, "productionMode");
    if (revision <= 0) {
      throw new IllegalArgumentException("revision must be positive");
    }
    scenes = List.copyOf(Objects.requireNonNull(scenes, "scenes"));
    Objects.requireNonNull(workload, "workload");
    Objects.requireNonNull(estimatedCost, "estimatedCost");
    if (estimatedCost.signum() < 0) {
      throw new IllegalArgumentException("estimatedCost must not be negative");
    }
    Objects.requireNonNull(createdAt, "createdAt");
    if (storyboardRevisionId != null && storyboardRevisionId <= 0) {
      throw new IllegalArgumentException("storyboardRevisionId must be positive");
    }
    if (workflowVersion != null && workflowVersion.isBlank()) {
      throw new IllegalArgumentException("workflowVersion must not be blank");
    }
  }

  public static MediaPlan create(
      Long chapterId,
      long chapterRowVersion,
      String sourceHash,
      ProductionMode productionMode,
      int revision,
      List<MediaScenePlan> scenes,
      MediaWorkload workload,
      BigDecimal estimatedCost,
      Instant createdAt) {
    return new MediaPlan(
        UUID.randomUUID(),
        chapterId,
        chapterRowVersion,
        sourceHash,
        productionMode,
        revision,
        scenes,
        workload,
        estimatedCost,
        createdAt);
  }

  public static MediaPlan createExecutable(
      Long chapterId,
      long chapterRowVersion,
      String sourceHash,
      ProductionMode productionMode,
      int revision,
      List<MediaScenePlan> scenes,
      MediaWorkload workload,
      BigDecimal estimatedCost,
      Instant createdAt,
      Long storyboardRevisionId,
      String imageAspectRatio,
      String imageQualityTier,
      String imageProviderKey,
      String imageModelKey,
      String pricingSnapshotJson,
      String pricingFingerprint,
      String narrationSetId,
      String narrationAlignmentRunId) {
    return new MediaPlan(
        UUID.randomUUID(),
        chapterId,
        chapterRowVersion,
        sourceHash,
        productionMode,
        revision,
        scenes,
        workload,
        estimatedCost,
        createdAt,
        storyboardRevisionId,
        "media-mvp-v1",
        imageAspectRatio,
        imageQualityTier,
        imageProviderKey,
        imageModelKey,
        pricingSnapshotJson,
        pricingFingerprint,
        narrationSetId,
        narrationAlignmentRunId);
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value;
  }
}
