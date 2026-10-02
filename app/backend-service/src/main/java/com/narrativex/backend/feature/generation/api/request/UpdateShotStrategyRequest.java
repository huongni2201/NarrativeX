package com.narrativex.backend.feature.generation.api.request;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import jakarta.validation.constraints.NotNull;

public record UpdateShotStrategyRequest(
    @NotNull(message = "strategy must not be null") GenerationStrategy strategy) {}
