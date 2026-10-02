package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import java.util.UUID;

public record GenerateShotTakeCommand(
    UUID projectId,
    UUID shotId,
    GenerationStrategy strategy,
    Long seed,
    UUID retryFromTakeId,
    String retryReason) {}
