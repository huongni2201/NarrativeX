package com.narrativex.backend.feature.generation.domain.value;

import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import java.util.Objects;

/** Immutable execution decision for one visual beat. */
public record MediaBeatPlan(
    Long visualBeatId,
    int orderIndex,
    String visualIntent,
    String motionMode,
    MotionStrategy motionStrategy,
    String assetStrategy,
    String promptTemplateVersion,
    String promptSnapshot,
    String negativePrompt,
    Long audioStartMs,
    Long audioEndMs,
    Long audioDurationMs,
    String cameraMovement,
    String imageSettingsJson,
    String characterSnapshotJson,
    String snapshotFingerprint) {
  public MediaBeatPlan(
      Long visualBeatId,
      int orderIndex,
      String visualIntent,
      String motionMode,
      MotionStrategy motionStrategy) {
    this(
        visualBeatId,
        orderIndex,
        visualIntent,
        motionMode,
        motionStrategy,
        "GENERATE_NEW",
        "prompt-v1",
        visualIntent,
        null,
        null,
        null,
        null,
        "NONE",
        "{}",
        "{}",
        null);
  }

  public MediaBeatPlan {
    if (visualBeatId == null || visualBeatId <= 0) {
      throw new IllegalArgumentException("visualBeatId must be positive");
    }
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    visualIntent = required(visualIntent, "visualIntent");
    motionMode = required(motionMode, "motionMode");
    Objects.requireNonNull(motionStrategy, "motionStrategy");
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value;
  }
}
