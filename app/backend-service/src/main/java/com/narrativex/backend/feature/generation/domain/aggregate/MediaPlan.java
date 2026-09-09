package com.narrativex.backend.feature.generation.domain.aggregate;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.MediaScenePlan;
import com.narrativex.backend.feature.generation.domain.value.MediaWorkload;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Immutable, versioned media execution plan. */
public record MediaPlan(
    UUID id,
    UUID chapterId,
    long chapterRowVersion,
    String sourceHash,
    ProductionMode productionMode,
    int revision,
    List<MediaScenePlan> scenes,
    MediaWorkload workload,
    Instant createdAt,
    UUID storyboardRevisionId,
    String workflowVersion,
    String imageAspectRatio,
    String imageProviderKey,
    String imageModelKey,
    UUID narrationSetId,
    UUID narrationAlignmentRunId) {

  public MediaPlan {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(chapterId, "chapterId");
    if (chapterRowVersion < 0)
      throw new IllegalArgumentException("chapterRowVersion must not be negative");
    sourceHash = required(sourceHash, "sourceHash");
    Objects.requireNonNull(productionMode, "productionMode");
    if (revision <= 0) throw new IllegalArgumentException("revision must be positive");
    scenes = List.copyOf(Objects.requireNonNull(scenes, "scenes"));
    Objects.requireNonNull(workload, "workload");
    Objects.requireNonNull(createdAt, "createdAt");
    if (workflowVersion != null && workflowVersion.isBlank())
      throw new IllegalArgumentException("workflowVersion must not be blank");
  }

  public static MediaPlan createExecutable(
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      ProductionMode productionMode,
      int revision,
      List<MediaScenePlan> scenes,
      MediaWorkload workload,
      Instant createdAt,
      UUID storyboardRevisionId,
      String imageAspectRatio,
      String imageProviderKey,
      String imageModelKey,
      UUID narrationSetId,
      UUID narrationAlignmentRunId) {
    return new MediaPlan(
        UuidV7.random(),
        chapterId,
        chapterRowVersion,
        sourceHash,
        productionMode,
        revision,
        scenes,
        workload,
        createdAt,
        storyboardRevisionId,
        "media-mvp-v1",
        imageAspectRatio,
        imageProviderKey,
        imageModelKey,
        narrationSetId,
        narrationAlignmentRunId);
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
