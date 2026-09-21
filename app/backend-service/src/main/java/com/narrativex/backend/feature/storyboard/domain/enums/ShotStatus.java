package com.narrativex.backend.feature.storyboard.domain.enums;

/** Lifecycle states of a Shot within the video production pipeline. */
public enum ShotStatus {
  PLANNED,
  REFERENCE_PREPARING,
  READY,
  QUEUED,
  GENERATING,
  GENERATED,
  VALIDATING,
  PASSED,
  FAILED,
  RETRY_READY,
  MANUAL_REVIEW,
  SELECTED
}
