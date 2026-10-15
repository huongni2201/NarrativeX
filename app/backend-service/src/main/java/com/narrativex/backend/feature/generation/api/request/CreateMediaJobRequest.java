package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateMediaJobRequest(
    @NotBlank @Pattern(regexp = "IMAGE_MOTION|VIDEO_FIRST|LEGACY_IMAGE") String productionMode,
    @Pattern(regexp = "16:9|9:16|1:1|4:3|3:4") String aspectRatio,
    // Deprecated and ignored: the visual style comes from Settings -> Prompt.
    @Pattern(regexp = "CINEMATIC|STORYBOOK_WATERCOLOR|CINEMATIC_ANIME") String imageStyle,
    @Pattern(regexp = "IMAGE|VIDEO") String visualGenerationMode,
    @Pattern(regexp = "API") String imageProvider,
    // Revision of the prompt settings the user reviewed in a preview, as a decimal string.
    @Pattern(regexp = "[0-9]{1,18}") String expectedPromptRevision) {

  public CreateMediaJobRequest(
      String productionMode,
      String aspectRatio,
      String imageStyle,
      String visualGenerationMode,
      String imageProvider) {
    this(productionMode, aspectRatio, imageStyle, visualGenerationMode, imageProvider, null);
  }

  public Long expectedPromptRevisionValue() {
    return expectedPromptRevision == null || expectedPromptRevision.isBlank()
        ? null
        : Long.parseLong(expectedPromptRevision);
  }

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
