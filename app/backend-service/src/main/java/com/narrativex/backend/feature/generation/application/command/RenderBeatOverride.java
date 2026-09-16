package com.narrativex.backend.feature.generation.application.command;

import java.util.Set;
import java.util.UUID;

/** Render-only visual edit applied to an immutable render-input snapshot. */
public record RenderBeatOverride(
    UUID visualBeatId, Long durationMs, String cameraMovement, String fitMode, Long trimStartMs) {
  private static final Set<String> CAMERA_MOVEMENTS =
      Set.of(
          "NONE", "PAN", "TILT", "PUSH_IN", "PULL_OUT", "TRACK", "ZOOM_IN", "ZOOM_OUT", "PARALLAX");
  private static final Set<String> FIT_MODES = Set.of("TRIM", "LOOP", "FREEZE_END", "SPEED_ADJUST");

  public RenderBeatOverride {
    if (visualBeatId == null) {
      throw new IllegalArgumentException("visualBeatId must not be null");
    }
    if (durationMs != null) {
      throw new IllegalArgumentException(
          "durationMs is derived from narration alignment and cannot be overridden");
    }
    if (cameraMovement != null) {
      cameraMovement = cameraMovement.trim().toUpperCase();
      if (!CAMERA_MOVEMENTS.contains(cameraMovement)) {
        throw new IllegalArgumentException("Unsupported camera movement: " + cameraMovement);
      }
    }
    if (fitMode != null) {
      fitMode = fitMode.trim().toUpperCase();
      if (!FIT_MODES.contains(fitMode)) {
        throw new IllegalArgumentException("Unsupported fit mode: " + fitMode);
      }
    }
    if (trimStartMs != null && trimStartMs < 0) {
      throw new IllegalArgumentException("trimStartMs must be >= 0");
    }
    if (cameraMovement == null && fitMode == null && trimStartMs == null) {
      throw new IllegalArgumentException(
          "A render beat override must change at least one visual render parameter");
    }
  }

  public RenderBeatOverride(UUID visualBeatId, Long durationMs, String cameraMovement) {
    this(visualBeatId, durationMs, cameraMovement, null, null);
  }
}
