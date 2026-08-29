package com.narrativex.backend.feature.assets.api.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Voice-reference upload intent. The media kind is inherently audio. */
public record CreateUploadIntentRequest(
    @NotBlank @Size(max = 255) String originalFilename,
    @NotBlank @Size(max = 160) String contentType,
    @Positive @Max(1073741824L) long expectedSizeBytes,
    @NotBlank @Pattern(regexp = "[0-9a-f]{64}") String expectedSha256) {}
