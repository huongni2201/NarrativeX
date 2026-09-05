package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateRegenerationPlanRequest(
    @NotNull UUID expectedPlanId,
    @NotEmpty @Size(max = 500) List<UUID> beatIds,
    @NotBlank @Size(max = 512) String reason) {}
