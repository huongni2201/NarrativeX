package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateRegenerationJobRequest(
    @NotNull UUID regenerationPlanId,
    @NotNull @DecimalMin(value = "0.0", inclusive = true) BigDecimal maxAuthorizedCost) {}
