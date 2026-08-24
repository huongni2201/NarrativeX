package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateProjectRenderCommand(
    UUID projectId,
    String resolution,
    String format,
    BigDecimal maxAuthorizedCost,
    String idempotencyKey) {}
