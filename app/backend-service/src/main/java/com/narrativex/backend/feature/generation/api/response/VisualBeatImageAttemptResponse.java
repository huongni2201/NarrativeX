package com.narrativex.backend.feature.generation.api.response;

import java.time.Instant;
import java.util.UUID;

public record VisualBeatImageAttemptResponse(
    UUID itemId,
    UUID jobId,
    UUID mediaPlanId,
    UUID storyboardRevisionId,
    boolean currentStoryboardRevision,
    int attemptNumber,
    String executionStatus,
    UUID mediaAssetId,
    String reviewStatus,
    Instant reviewedAt,
    String errorCode,
    long rowVersion) {}
