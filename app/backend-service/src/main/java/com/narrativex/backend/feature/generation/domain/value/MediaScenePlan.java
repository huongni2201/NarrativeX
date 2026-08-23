package com.narrativex.backend.feature.generation.domain.value;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Immutable scene snapshot inside a media plan. */
public record MediaScenePlan(
    UUID sceneId,
    int orderIndex,
    String narration,
    Integer durationSeconds,
    List<MediaBeatPlan> beats) {
  public MediaScenePlan {
    Objects.requireNonNull(sceneId, "sceneId must not be null");
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    if (durationSeconds != null && durationSeconds < 0) {
      throw new IllegalArgumentException("durationSeconds must not be negative");
    }
    beats = List.copyOf(Objects.requireNonNull(beats, "beats"));
  }
}
