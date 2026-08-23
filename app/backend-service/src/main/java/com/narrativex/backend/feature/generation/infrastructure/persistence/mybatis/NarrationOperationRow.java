package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;

public record NarrationOperationRow(
    UUID id, UUID narrationRequestId, UUID generationJobId, UUID stageAttemptId) {}
