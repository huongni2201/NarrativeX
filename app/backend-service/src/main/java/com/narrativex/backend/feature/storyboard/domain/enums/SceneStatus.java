package com.narrativex.backend.feature.storyboard.domain.enums;

/** Canonical storyboard scene lifecycle from the NarrativeX V1.8 domain model. */
public enum SceneStatus {
  DRAFT,
  READY_FOR_VISUAL,
  GENERATING,
  REVIEW,
  APPROVED,
  FAILED,
  OUTDATED
}
