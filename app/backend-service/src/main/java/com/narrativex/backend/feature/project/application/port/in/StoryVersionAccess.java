package com.narrativex.backend.feature.project.application.port.in;

/** Cross-feature contract for ownership-checked StoryVersion scope validation. */
public interface StoryVersionAccess {
  void requireOwnedStoryVersion(Long projectId, Long storyVersionId, String ownerId);
}
