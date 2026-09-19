package com.narrativex.backend.feature.storyboard.api.request;

import com.narrativex.backend.feature.storyboard.domain.enums.StoryBeatReviewStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateStoryBeatReviewStatusRequest(@NotNull StoryBeatReviewStatus status) {}
