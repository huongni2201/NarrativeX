package com.narrativex.backend.feature.assets.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record RegisterLocalAssetRequest(
    @NotNull UUID projectId,
    @NotBlank String type,
    @NotBlank @Size(max = 255) String originalFilename,
    @NotBlank @Size(max = 160) String contentType,
    @Positive long sizeBytes,
    @NotBlank @Size(min = 64, max = 64) String checksumSha256,
    Long durationMs) {}
