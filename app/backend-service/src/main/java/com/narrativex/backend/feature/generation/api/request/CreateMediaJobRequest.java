package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateMediaJobRequest(
    @NotBlank @Pattern(regexp = "IMAGE_MOTION") String productionMode,
    @NotBlank @Pattern(regexp = "16:9|9:16|1:1|4:3|3:4") String aspectRatio,
    @Pattern(regexp = "CINEMATIC|STORYBOOK_WATERCOLOR") String imageStyle,
    @Pattern(regexp = "IMAGE|VIDEO") String visualGenerationMode,
    @Pattern(regexp = "GEMINI_WEB|API") String imageProvider) {

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
