package com.narrativex.backend.feature.storyboard.api.response;

import java.util.UUID;

public record StoryBeatResponse(
    UUID id,
    UUID sceneId,
    int orderIndex,
    String purpose,
    String summary,
    String importance,
    String reviewStatus,
    long rowVersion) {}
