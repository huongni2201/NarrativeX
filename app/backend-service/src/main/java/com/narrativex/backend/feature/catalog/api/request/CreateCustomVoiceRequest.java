package com.narrativex.backend.feature.catalog.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateCustomVoiceRequest(
    @NotBlank @Size(max = 64) String name,
    @Size(max = 32) String language,
    @Pattern(regexp = "MALE|FEMALE|NEUTRAL") String gender,
    @Size(max = 500) String description,
    @NotNull UUID referenceAssetId) {}
