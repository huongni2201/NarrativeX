package com.narrativex.backend.feature.storyboard.api.request;

import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateVisualBeatReviewStatusRequest(@NotNull VisualBeatReviewStatus status) {}
