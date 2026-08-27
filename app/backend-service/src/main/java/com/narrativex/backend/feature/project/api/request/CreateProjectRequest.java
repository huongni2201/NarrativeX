package com.narrativex.backend.feature.project.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateProjectRequest(
    @NotBlank @Size(max = 160) String name,
    @Size(max = 2000) String description,
    @Size(max = 16) String sourceLanguage,
    @Size(max = 16) String narrationLanguage,
    @Size(max = 16) String metadataLanguage,
    @Size(max = 8) @Pattern(regexp = "^(16:9|9:16|1:1|4:3|3:4)$") String imageAspectRatio,
    @Size(max = 16) String imageQualityTier) {}
