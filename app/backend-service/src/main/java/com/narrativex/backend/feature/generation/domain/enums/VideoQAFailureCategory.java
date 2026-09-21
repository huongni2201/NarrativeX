package com.narrativex.backend.feature.generation.domain.enums;

/** Failure categories detected by Video QA validation. */
public enum VideoQAFailureCategory {
  FACE_IDENTITY,
  CHARACTER_CONSISTENCY,
  ANATOMY,
  MOTION,
  TEMPORAL_ARTIFACT,
  CAMERA,
  COMPOSITION,
  PROMPT_ADHERENCE,
  CONTINUITY,
  DURATION,
  TECHNICAL_OUTPUT
}
