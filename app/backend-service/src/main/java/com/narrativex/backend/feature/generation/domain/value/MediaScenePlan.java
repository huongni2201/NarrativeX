package com.narrativex.backend.feature.generation.domain.value;

import java.util.List;
import java.util.Objects;

/** Immutable scene snapshot inside a media plan. */
public record MediaScenePlan(
    Long sceneId,
    int orderIndex,
    String narration,
    Integer durationSeconds,
    List<MediaBeatPlan> beats) {
  public MediaScenePlan {
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
