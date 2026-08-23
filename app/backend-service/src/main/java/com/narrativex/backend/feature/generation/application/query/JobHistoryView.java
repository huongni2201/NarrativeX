package com.narrativex.backend.feature.generation.application.query;

import java.time.Instant;
import java.util.UUID;

public record JobHistoryView(
    UUID id,
    UUID jobId,
    UUID projectId,
    String projectName,
    String jobType,
    String status,
    int progress,
    String currentStep,
    String errorCode,
    Instant createdAt,
    Instant completedAt) {}
