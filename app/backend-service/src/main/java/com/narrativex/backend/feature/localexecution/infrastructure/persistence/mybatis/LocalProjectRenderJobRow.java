package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.util.UUID;

public record LocalProjectRenderJobRow(
    UUID stageAttemptId,
    UUID generationJobId,
    UUID jobId,
    UUID projectId,
    UUID storyVersionId,
    String resolution,
    String renderFormat,
    String aspectRatio,
    long totalDurationMs,
    String renderProfileJson) {}
