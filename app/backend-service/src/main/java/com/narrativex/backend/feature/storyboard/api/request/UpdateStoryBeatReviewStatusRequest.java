package com.narrativex.backend.feature.storyboard.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateStoryBeatReviewStatusRequest(
    @NotBlank
    @Pattern(
        regexp = "NOT_READY|NEEDS_REVIEW|APPROVED|REJECTED",
        message = "status must be NOT_READY, NEEDS_REVIEW, APPROVED, or REJECTED")
    String status) {}
