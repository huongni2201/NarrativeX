package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Cross-feature immutable projection of the current storyboard used for media planning. */
public record MediaPlanningSource(
    List<SceneSnapshot> scenes,
    UUID storyboardRevisionId,
    String sourceHash,
    UUID narrationSetId,
    UUID narrationAlignmentRunId) {
  public MediaPlanningSource(List<SceneSnapshot> scenes) {
    this(scenes, null, null, null, null);
  }

  public MediaPlanningSource {
    scenes = List.copyOf(Objects.requireNonNull(scenes, "scenes"));
  }

  public record SceneSnapshot(
      UUID sceneId,
      int orderIndex,
      String narration,
      Integer durationSeconds,
      List<BeatSnapshot> beats) {
    public SceneSnapshot {
      Objects.requireNonNull(sceneId, "sceneId");
      if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");
      if (durationSeconds != null && durationSeconds < 0)
        throw new IllegalArgumentException("durationSeconds must not be negative");
      beats = List.copyOf(Objects.requireNonNull(beats, "beats"));
    }
  }

  public record BeatSnapshot(
      UUID visualBeatId,
      int orderIndex,
      String visualIntent,
      MotionIntent motionIntent,
      String reviewStatus,
      String cameraMovement,
      String cameraAngle,
      String aspectRatioOverride,
      Long audioStartMs,
      Long audioEndMs,
      String visualDirectionJson) {
    public BeatSnapshot(
        UUID visualBeatId, int orderIndex, String visualIntent, MotionIntent motionIntent) {
      this(
          visualBeatId,
          orderIndex,
          visualIntent,
          motionIntent,
          "APPROVED",
          "NONE",
          "MEDIUM",
          null,
          null,
          null,
          null);
    }

    public BeatSnapshot(
        UUID visualBeatId,
        int orderIndex,
        String visualIntent,
        MotionIntent motionIntent,
        String reviewStatus,
        String cameraMovement,
        String aspectRatioOverride,
        Long audioStartMs,
        Long audioEndMs) {
      this(
          visualBeatId,
          orderIndex,
          visualIntent,
          motionIntent,
          reviewStatus,
          cameraMovement,
          "MEDIUM",
          aspectRatioOverride,
          audioStartMs,
          audioEndMs,
          null);
    }

    public BeatSnapshot(
        UUID visualBeatId,
        int orderIndex,
        String visualIntent,
        MotionIntent motionIntent,
        String reviewStatus,
        String cameraMovement,
        String cameraAngle,
        String aspectRatioOverride,
        Long audioStartMs,
        Long audioEndMs) {
      this(
          visualBeatId,
          orderIndex,
          visualIntent,
          motionIntent,
          reviewStatus,
          cameraMovement,
          cameraAngle,
          aspectRatioOverride,
          audioStartMs,
          audioEndMs,
          null);
    }

    public BeatSnapshot {
      Objects.requireNonNull(visualBeatId, "visualBeatId");
      if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");
      if (visualIntent == null || visualIntent.isBlank())
        throw new IllegalArgumentException("visualIntent must not be blank");
      Objects.requireNonNull(motionIntent, "motionIntent");
      cameraAngle = cameraAngle == null || cameraAngle.isBlank() ? "MEDIUM" : cameraAngle;
      visualDirectionJson =
          visualDirectionJson == null || visualDirectionJson.isBlank()
              ? null
              : visualDirectionJson.trim();
    }
  }

  /** Semantic/editor intent projected from VisualBeat.motionMode, not an execution strategy. */
  public enum MotionIntent {
    STILL,
    BASIC_MOTION,
    AI_VIDEO
  }
}
