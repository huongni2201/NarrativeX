package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record EstimateMediaJobRequest(
    @NotBlank @Pattern(regexp = "IMAGE_MOTION") String productionMode,
    @NotBlank @Pattern(regexp = "16:9|9:16|1:1|4:3|3:4") String aspectRatio,
    @NotBlank @Pattern(regexp = "DRAFT|STANDARD|HIGH") String qualityTier,
    @Pattern(regexp = "CINEMATIC|STORYBOOK_WATERCOLOR") String imageStyle) {}
