package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record ReviewMediaGenerationItemRequest(
    @NotBlank @Pattern(regexp = "APPROVED|REJECTED") String decision, @NotNull Long rowVersion) {}
