package com.narrativex.backend.modules.project.api.response;

import com.narrativex.backend.modules.project.domain.aggregate.StoryVersion;
import java.time.Instant;

public record StoryVersionResponse(
    Long id,
    Long projectId,
    int versionNumber,
    String status,
    String moderationDecision,
    boolean rightsAttested,
    String rightsPolicyVersion,
    String rightsBasis,
    Instant rightsAttestedAt,
    int contentCharacterCount
) {
    public static StoryVersionResponse from(StoryVersion storyVersion) {
        return new StoryVersionResponse(storyVersion.getId(), storyVersion.getProjectId(),
            storyVersion.getVersionNumber(), storyVersion.getStatus().name(),
            storyVersion.getModerationDecision().name(), storyVersion.isRightsAttested(),
            storyVersion.getRightsPolicyVersion(), storyVersion.getRightsBasis(), storyVersion.getRightsAttestedAt(),
            storyVersion.getContent().codePointCount(0, storyVersion.getContent().length()));
    }
}
