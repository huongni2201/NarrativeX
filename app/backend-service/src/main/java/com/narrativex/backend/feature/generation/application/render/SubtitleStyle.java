package com.narrativex.backend.feature.generation.application.render;

import java.util.Locale;
import java.util.Set;

/** Validated display settings; no user-supplied ASS commands or font paths. */
public record SubtitleStyle(
    int version,
    String position,
    String preset,
    String fontFamily,
    int fontWeight,
    double fontSizeRatio,
    double edgeMarginRatio,
    String primaryColor,
    String outlineColor,
    String backgroundColor,
    double backgroundOpacity) {
  private static final Set<String> POSITIONS =
      Set.of(
          "TOP_LEFT",
          "TOP_CENTER",
          "TOP_RIGHT",
          "MIDDLE_LEFT",
          "MIDDLE_CENTER",
          "MIDDLE_RIGHT",
          "BOTTOM_LEFT",
          "BOTTOM_CENTER",
          "BOTTOM_RIGHT");
  private static final Set<String> PRESETS = Set.of("DEFAULT", "OUTLINE", "SHADOW", "BACKGROUND");
  private static final Set<String> FONTS = Set.of("Arial", "Verdana", "Georgia", "Tahoma");

  public SubtitleStyle {
    if (version != 2
        || position == null
        || !POSITIONS.contains(position)
        || preset == null
        || !PRESETS.contains(preset)
        || fontFamily == null
        || !FONTS.contains(fontFamily)
        || (fontWeight != 400 && fontWeight != 700)
        || !range(fontSizeRatio, 0.02, 0.08)
        || !range(edgeMarginRatio, 0.02, 0.2)
        || !range(backgroundOpacity, 0, 1)) {
      throw new IllegalArgumentException("Invalid subtitle style");
    }
    primaryColor = color(primaryColor);
    outlineColor = color(outlineColor);
    backgroundColor = color(backgroundColor);
  }

  public static SubtitleStyle defaults() {
    return new SubtitleStyle(
        2,
        "BOTTOM_CENTER",
        "DEFAULT",
        "Arial",
        700,
        0.034,
        0.07,
        "#FFFFFF",
        "#000000",
        "#000000",
        0.75);
  }

  public String toJson() {
    return """
        {"version":2,"position":"%s","preset":"%s","fontFamily":"%s","fontWeight":%d,"fontSizeRatio":%s,"edgeMarginRatio":%s,"primaryColor":"%s","outlineColor":"%s","backgroundColor":"%s","backgroundOpacity":%s}
        """
        .formatted(
            position,
            preset,
            fontFamily,
            fontWeight,
            fontSizeRatio,
            edgeMarginRatio,
            primaryColor,
            outlineColor,
            backgroundColor,
            backgroundOpacity)
        .strip();
  }

  private static boolean range(double value, double min, double max) {
    return Double.isFinite(value) && value >= min && value <= max;
  }

  private static String color(String value) {
    if (value == null || !value.matches("#[0-9a-fA-F]{6}")) {
      throw new IllegalArgumentException("Invalid subtitle style color");
    }
    return value.toUpperCase(Locale.ROOT);
  }
}
