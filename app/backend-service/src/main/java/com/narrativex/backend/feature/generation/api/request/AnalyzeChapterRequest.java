package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.Pattern;

/** Optional analysis preferences used to prepare the downstream visual workflow. */
public record AnalyzeChapterRequest(
    @Pattern(regexp = "IMAGE|VIDEO") String visualGenerationMode,
    @Pattern(regexp = "GEMINI_WEB|API") String imageProvider) {

  public String effectiveVisualGenerationMode() {
    return visualGenerationMode == null || visualGenerationMode.isBlank()
        ? "IMAGE"
        : visualGenerationMode;
  }

  public String effectiveImageProvider() {
    if (!"IMAGE".equals(effectiveVisualGenerationMode())) {
      return null;
    }
    return imageProvider == null || imageProvider.isBlank() ? "API" : imageProvider;
  }
}
