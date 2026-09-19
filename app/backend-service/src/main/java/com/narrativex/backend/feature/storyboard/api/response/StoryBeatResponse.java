package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.enums.StoryBeatReviewStatus;
import java.util.UUID;

public record StoryBeatResponse(
    UUID id,
    UUID sceneId,
    int orderIndex,
    String purpose,
    String summary,
    String importance,
    StoryBeatReviewStatus reviewStatus,
    long rowVersion) {}
