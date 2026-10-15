package com.narrativex.backend.feature.generation.domain.enums;

import java.util.Locale;

/**
 * Legacy visual-style preset ids kept for API and persistence compatibility. Prompt text for these
 * presets lives in the installation-wide Prompt settings (see {@code PromptSettingsDefaults}), not
 * in code; custom styles use ids that are not part of this enum.
 */
public enum ImageStyle {
  CINEMATIC,
  STORYBOOK_WATERCOLOR,
  CINEMATIC_ANIME;

  /** Parses a legacy preset id; a missing value maps to {@link #CINEMATIC}. */
  public static ImageStyle from(String value) {
    if (value == null || value.isBlank()) {
      return CINEMATIC;
    }
    try {
      return valueOf(value.trim().toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("Unsupported image style: " + value, exception);
    }
  }
}
