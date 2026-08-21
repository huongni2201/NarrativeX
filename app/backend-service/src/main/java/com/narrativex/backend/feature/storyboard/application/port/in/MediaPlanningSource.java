package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.List;
import java.util.Objects;

/** Cross-feature immutable projection of the current storyboard used for media planning. */
public record MediaPlanningSource(
    List<SceneSnapshot> scenes,
    Long storyboardRevisionId,
    String sourceHash,
    String narrationSetId,
    String narrationAlignmentRunId) {
  public MediaPlanningSource(List<SceneSnapshot> scenes) {
    this(scenes, null, null, null, null);
  }

  public MediaPlanningSource {
    scenes = List.copyOf(Objects.requireNonNull(scenes, "scenes"));
    if (storyboardRevisionId != null && storyboardRevisionId <= 0) {
      throw new IllegalArgumentException("storyboardRevisionId must be positive");
    }
  }

  public record SceneSnapshot(
      Long sceneId,
      int orderIndex,
      String narration,
      Integer durationSeconds,
      List<BeatSnapshot> beats) {
    public SceneSnapshot {
      if (sceneId == null || sceneId <= 0) {
        throw new IllegalArgumentException("sceneId must be positive");
      }
      if (orderIndex < 0) {
        throw new IllegalArgumentException("orderIndex must not be negative");
      }
      if (durationSeconds != null && durationSeconds < 0) {
        throw new IllegalArgumentException("durationSeconds must not be negative");
      }
      beats = List.copyOf(Objects.requireNonNull(beats, "beats"));
    }
  }

  public record BeatSnapshot(
      Long visualBeatId,
      int orderIndex,
      String visualIntent,
      MotionIntent motionIntent,
      String reviewStatus,
      String cameraMovement,
      String aspectRatioOverride,
      String qualityTierOverride,
      Long audioStartMs,
      Long audioEndMs) {
    public BeatSnapshot(
        Long visualBeatId, int orderIndex, String visualIntent, MotionIntent motionIntent) {
      this(visualBeatId, orderIndex, visualIntent, motionIntent, "APPROVED", "NONE", null, null, null, null);
    }

    public BeatSnapshot {
      if (visualBeatId == null || visualBeatId <= 0) {
        throw new IllegalArgumentException("visualBeatId must be positive");
      }
      if (orderIndex < 0) {
        throw new IllegalArgumentException("orderIndex must not be negative");
      }
      if (visualIntent == null || visualIntent.isBlank()) {
        throw new IllegalArgumentException("visualIntent must not be blank");
      }
      Objects.requireNonNull(motionIntent, "motionIntent");
    }
  }

  /** Semantic/editor intent projected from VisualBeat.motionMode, not an execution strategy. */
  public enum MotionIntent {
    STILL,
    BASIC_MOTION,
    AI_VIDEO
  }
}
