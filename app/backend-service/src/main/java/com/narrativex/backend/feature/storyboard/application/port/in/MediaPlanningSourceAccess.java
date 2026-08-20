package com.narrativex.backend.feature.storyboard.application.port.in;

/** Read-only cross-feature boundary for the current storyboard snapshot used by media planning. */
public interface MediaPlanningSourceAccess {
  MediaPlanningSource requireCurrent(Long chapterId);
}
