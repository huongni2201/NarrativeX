package com.narrativex.backend.feature.common.domain.enums;

/** Video generation strategy assigned to a shot and executed in a take. */
public enum GenerationStrategy {
  TEXT_TO_VIDEO,
  IMAGE_TO_VIDEO,
  FIRST_LAST_FRAME,
  MULTI_KEYFRAME,
  VIDEO_EXTEND,
  VIDEO_RETAKE
}
