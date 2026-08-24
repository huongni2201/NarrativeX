package com.narrativex.backend.feature.generation.application.command;

import java.util.Set;
import java.util.UUID;

/** Render-only timing/motion edit applied to an immutable render-input snapshot. */
public record RenderBeatOverride(UUID visualBeatId, Long durationMs, String cameraMovement) {
  private static final Set<String> CAMERA_MOVEMENTS =
      Set.of(
          "NONE",
          "PAN",
          "TILT",
          "PUSH_IN",
          "PULL_OUT",
          "TRACK",
          "ZOOM_IN",
          "ZOOM_OUT",
          "PARALLAX");

  public RenderBeatOverride {
    if (visualBeatId == null) {
      throw new IllegalArgumentException("visualBeatId must not be null");
    }
    if (durationMs != null && (durationMs < 1_000 || durationMs > 120_000)) {
      throw new IllegalArgumentException("durationMs must be between 1000 and 120000");
    }
    if (cameraMovement != null) {
      cameraMovement = cameraMovement.trim().toUpperCase();
      if (!CAMERA_MOVEMENTS.contains(cameraMovement)) {
        throw new IllegalArgumentException("Unsupported camera movement: " + cameraMovement);
      }
    }
    if (durationMs == null && cameraMovement == null) {
      throw new IllegalArgumentException("A render beat override must change duration or movement");
    }
  }
}
