package com.narrativex.backend.feature.assets.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

public record UploadMediaAssetRequest(
    UUID id,
    @NotBlank @Pattern(regexp = "AUDIO|IMAGE|VIDEO") String type,
    @NotBlank @Pattern(regexp = "USER_UPLOAD|TTS_GENERATED|IMAGE_GENERATED|VIDEO_GENERATED")
        String origin,
    @NotBlank String storageKey,
    @NotBlank String originalFilename,
    @NotBlank String contentType,
    @Positive long sizeBytes,
    @NotBlank @Pattern(regexp = "[0-9a-f]{64}") String sha256,
    @Positive Long durationMs) {}
