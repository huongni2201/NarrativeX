package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record CreateMediaJobRequest(
    @NotBlank @Pattern(regexp = "IMAGE_MOTION") String productionMode,
    @NotBlank @Pattern(regexp = "16:9|9:16|1:1|4:3|3:4") String aspectRatio,
    @NotBlank @Pattern(regexp = "DRAFT|STANDARD|HIGH") String qualityTier,
    @NotNull @DecimalMin(value = "0.000001") BigDecimal maxAuthorizedCost,
    @Pattern(regexp = "CINEMATIC|STORYBOOK_WATERCOLOR") String imageStyle,
    @Pattern(regexp = "IMAGE|VIDEO") String visualGenerationMode,
    @Pattern(regexp = "GEMINI_WEB|API") String imageProvider,
    @Pattern(regexp = "GENERATE_NEW|REUSE_APPROVED|REFRAME_DERIVED") String imageGenerationStrategy) {

  public String effectiveVisualGenerationMode() {
    return visualGenerationMode == null || visualGenerationMode.isBlank()
        ? "IMAGE"
        : visualGenerationMode;
  }

  public String effectiveImageProvider() {
    if (!"IMAGE".equals(effectiveVisualGenerationMode())) return null;
    return imageProvider == null || imageProvider.isBlank() ? "API" : imageProvider;
  }
}
