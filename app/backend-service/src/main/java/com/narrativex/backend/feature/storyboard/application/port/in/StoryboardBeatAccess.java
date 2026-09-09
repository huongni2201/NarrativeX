package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.Set;
import java.util.UUID;

/** Narrow cross-feature capability exposing the current owned storyboard beat scope. */
public interface StoryboardBeatAccess {
  Set<UUID> requireCurrentBeatIds(UUID projectId, UUID chapterId);
}
