package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;

public record ProductionInsightRow(
    UUID id,
    long rowVersion,
    Instant createdAt,
    UUID projectId,
    UUID chapterId,
    String observationJson,
    String recommendationText,
    String status) {}
