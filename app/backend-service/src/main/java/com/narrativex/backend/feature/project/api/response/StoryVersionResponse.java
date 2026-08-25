package com.narrativex.backend.feature.project.api.response;

import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import java.util.UUID;

public record StoryVersionResponse(
    UUID id, UUID projectId, int versionNumber, String status, int contentCharacterCount) {
  public static StoryVersionResponse from(StoryVersion storyVersion) {
    return new StoryVersionResponse(
        storyVersion.getId(),
        storyVersion.getProjectId(),
        storyVersion.getVersionNumber(),
        storyVersion.getStatus().name(),
        storyVersion.getContent().codePointCount(0, storyVersion.getContent().length()));
  }
}
