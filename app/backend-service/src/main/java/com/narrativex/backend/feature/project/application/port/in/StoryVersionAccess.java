package com.narrativex.backend.feature.project.application.port.in;

import java.util.UUID;

/** Cross-feature contract for StoryVersion scope validation. */
public interface StoryVersionAccess {
  void requireStoryVersion(UUID projectId, UUID storyVersionId);

  UUID resolveOrCreateStoryVersion(UUID projectId, String fallbackContent);
}
