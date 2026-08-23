package com.narrativex.backend.feature.project.application.port.in;

import java.util.UUID;

/** Cross-feature contract for ownership-checked StoryVersion scope validation. */
public interface StoryVersionAccess {
  void requireOwnedStoryVersion(UUID projectId, UUID storyVersionId, String ownerId);

  UUID resolveOrCreateStoryVersion(UUID projectId, String ownerId, String fallbackContent);
}
