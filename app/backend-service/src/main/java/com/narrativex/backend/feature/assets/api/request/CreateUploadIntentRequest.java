package com.narrativex.backend.feature.assets.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

public record CreateUploadIntentRequest(
    @NotBlank @Pattern(regexp = "AUDIO|IMAGE|VIDEO") String type,
    @NotBlank String originalFilename,
    @NotBlank String contentType,
    @Positive long expectedSizeBytes,
    @NotBlank @Pattern(regexp = "[0-9a-f]{64}") String expectedSha256) {}
