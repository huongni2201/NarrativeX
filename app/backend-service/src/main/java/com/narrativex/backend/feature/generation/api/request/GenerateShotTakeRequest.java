package com.narrativex.backend.feature.generation.api.request;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import java.util.UUID;

public record GenerateShotTakeRequest(
    GenerationStrategy strategy, Long seed, UUID retryFromTakeId, String retryReason) {}
