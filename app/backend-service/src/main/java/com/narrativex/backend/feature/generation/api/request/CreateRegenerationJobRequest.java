package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateRegenerationJobRequest(@NotNull UUID regenerationPlanId) {}
