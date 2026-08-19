package com.narrativex.backend.feature.generation.application.query;

import java.time.Instant;

public record JobHistoryView(
    long id,
    String jobId,
    Long projectId,
    String projectName,
    String jobType,
    String status,
    int progress,
    String currentStep,
    String errorCode,
    Instant createdAt,
    Instant completedAt) {}
