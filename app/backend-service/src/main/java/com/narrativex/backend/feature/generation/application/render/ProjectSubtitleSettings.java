package com.narrativex.backend.feature.generation.application.render;

public record ProjectSubtitleSettings(Boolean enabled, SubtitleStyle style) {
  public ProjectSubtitleSettings {
    if (enabled == null || style == null)
      throw new IllegalArgumentException("Subtitle settings are required");
  }

  public static ProjectSubtitleSettings defaults() {
    return new ProjectSubtitleSettings(true, SubtitleStyle.defaults());
  }
}
