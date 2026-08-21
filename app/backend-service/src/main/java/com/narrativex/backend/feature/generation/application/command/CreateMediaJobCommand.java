package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;

public record CreateMediaJobCommand(
    Long projectId,
    Long chapterId,
    String idempotencyKey,
    String productionMode,
    String aspectRatio,
    String qualityTier,
    BigDecimal maxAuthorizedCost) {}
