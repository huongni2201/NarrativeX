package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.UUID;

/** Read-only cross-feature boundary for the current storyboard snapshot used by media planning. */
public interface MediaPlanningSourceAccess {
  MediaPlanningSource requireCurrent(UUID chapterId);
}
