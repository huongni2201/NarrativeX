package com.narrativex.backend.feature.generation.domain.enums;

import java.util.Locale;

/** Backend-owned visual style profile used to keep a media plan visually coherent. */
public enum ImageStyle {
  CINEMATIC(
      "cinematic visual storytelling, realistic film still, natural motivated lighting, "
          + "35mm lens, widescreen composition, balanced framing, realistic skin and fabric texture, "
          + "subtle depth of field, atmospheric perspective, warm-neutral cinematic color grading, "
          + "soft contrast, grounded production design, subtle film grain, consistent character appearance",
      "anime, cartoon, watercolor, illustration, plastic CGI, oversaturated colors, harsh HDR, "
          + "extreme contrast, random art style, inconsistent face, changing hairstyle, changing outfit, "
          + "distorted anatomy, text, logo, watermark"),
  STORYBOOK_WATERCOLOR(
      "storybook watercolor illustration, soft edges, expressive silhouettes, diffused light, "
          + "dreamy atmosphere, gentle paper texture, cohesive children's storybook visual language, "
          + "consistent character appearance",
      "photorealistic, harsh contrast, plastic CGI, oversaturated colors, random art style, "
          + "inconsistent face, changing hairstyle, changing outfit, distorted anatomy, text, logo, watermark"),
  MANHUA(
      "premium Chinese romantic-fantasy manhua illustration with a polished webtoon-cover finish, "
          + "semi-realistic anime and Chinese manhua aesthetic, elegant adult character rendering, "
          + "delicate highly detailed facial features, large expressive eyes with glossy catchlights, "
          + "smooth luminous skin with subtle natural shading, highly detailed hair with clean strands, "
          + "fine line art with polished digital painting, soft cel shading blended with realistic volume, "
          + "cinematic rim light and motivated key light, atmospheric depth, dramatic readable shadows, "
          + "rich luxurious color grading, strong focal separation, premium serialized manhua quality, "
          + "consistent face rendering, eye treatment, line quality, hair detail, skin rendering and lighting",
      "photorealistic photography, 3D render, CGI, western superhero comic, chibi, childish proportions, "
          + "flat vector art, watercolor, sketch-only, thick cartoon outlines, washed-out color, flat lighting, "
          + "harsh HDR, uncontrolled bloom, overexposure, low-detail faces, blurry eyes, malformed anatomy, "
          + "distorted hands, extra fingers, asymmetrical eyes, duplicated limbs, inconsistent character appearance, "
          + "montage, collage, split screen, contact sheet, multiple panels, text, caption, logo, watermark");

  private final String promptSuffix;
  private final String negativePrompt;

  ImageStyle(String promptSuffix, String negativePrompt) {
    this.promptSuffix = promptSuffix;
    this.negativePrompt = negativePrompt;
  }

  public String promptSuffix() {
    return promptSuffix;
  }

  public String negativePrompt() {
    return negativePrompt;
  }

  public String promptFor(String visualIntent) {
    if (visualIntent == null || visualIntent.isBlank()) {
      throw new IllegalArgumentException("visualIntent must not be blank");
    }
    return "GLOBAL VISUAL STYLE: " + promptSuffix + "\nSCENE DESCRIPTION: " + visualIntent;
  }

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
