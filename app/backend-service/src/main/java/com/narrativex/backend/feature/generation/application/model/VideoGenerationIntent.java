package com.narrativex.backend.feature.generation.application.model;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import java.util.UUID;

/** Reader for persisted legacy shot commands; new attempts use TakeInputSnapshot. */
public record VideoGenerationIntent(
    UUID shotId,
    GenerationStrategy strategy,
    Long seed,
    UUID retryFromTakeId,
    String retryReason) {}
