package com.narrativex.backend.feature.generation.domain.value;

import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import java.util.Objects;
import java.util.UUID;

/** Immutable execution decision for one visual beat. */
public record MediaBeatPlan(
    UUID visualBeatId,
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
    String snapshotFingerprint,
    UUID reuseSourceVisualBeatId) {
  public MediaBeatPlan(
      UUID visualBeatId,
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
        null,
        null);
  }

  /** Compatibility constructor for callers created before intra-plan image reuse was added. */
  public MediaBeatPlan(
      UUID visualBeatId,
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
    this(
        visualBeatId,
        orderIndex,
        visualIntent,
        motionMode,
        motionStrategy,
        assetStrategy,
        promptTemplateVersion,
        promptSnapshot,
        negativePrompt,
        audioStartMs,
        audioEndMs,
        audioDurationMs,
        cameraMovement,
        imageSettingsJson,
        characterSnapshotJson,
        snapshotFingerprint,
        null);
  }

  public MediaBeatPlan {
    Objects.requireNonNull(visualBeatId, "visualBeatId must not be null");
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    visualIntent = required(visualIntent, "visualIntent");
    motionMode = required(motionMode, "motionMode");
    Objects.requireNonNull(motionStrategy, "motionStrategy");
    assetStrategy = required(assetStrategy, "assetStrategy");
    boolean reusesSource =
        assetStrategy.equals("REUSE_APPROVED") || assetStrategy.equals("REFRAME_DERIVED");
    if (reusesSource && reuseSourceVisualBeatId == null) {
      throw new IllegalArgumentException(assetStrategy + " requires reuseSourceVisualBeatId");
    }
    if (!reusesSource && reuseSourceVisualBeatId != null) {
      throw new IllegalArgumentException(
          "reuseSourceVisualBeatId is only valid for reusable asset strategies");
    }
    if (visualBeatId.equals(reuseSourceVisualBeatId)) {
      throw new IllegalArgumentException("A visual beat cannot reuse itself");
    }
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value;
  }
}
