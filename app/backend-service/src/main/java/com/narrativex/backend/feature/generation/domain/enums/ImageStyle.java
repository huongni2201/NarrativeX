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
  CINEMATIC_ANIME(
      "high-quality cinematic anime illustration with a delicate, emotional, visually poetic Japanese anime aesthetic, "
          + "cinematic anime key visual with refined film-like composition, soft luminous atmospheric lighting, "
          + "strong natural backlight with soft rim light, dreamy glow and restrained light bloom, "
          + "expressive highly detailed glossy eyes with layered iris reflections and delicate eyelashes, "
          + "elegant anime facial proportions with subtle blush and nuanced emotional expressions, "
          + "flowing wind-swept hair rendered with many fine individual strands and luminous edge highlights, "
          + "clean delicate line art combined with soft painterly anime rendering and refined cel shading, "
          + "smooth gradient transitions, bright airy natural colors, warm sunlight, gentle pastel tones, "
          + "shallow depth of field, soft cinematic bokeh, atmospheric perspective and strong focal separation, "
          + "blurred foreground flowers, petals, leaves or light particles when appropriate to the scene, "
          + "subtle drifting petals, dust motes, floating light or water droplets when contextually appropriate, "
          + "poetic wistful intimate melancholic atmosphere, emotionally focused visual storytelling, "
          + "polished high-detail digital anime artwork with consistent face rendering, eye treatment, "
          + "hair detail, line quality, lighting language and character appearance across the series",
      "photorealistic photography, realistic live-action look, 3D render, CGI, western superhero comic, "
          + "chibi, childish proportions, flat vector art, watercolor-only rendering, sketch-only rendering, "
          + "thick cartoon outlines, dull colors, muddy colors, neon oversaturation, flat lighting, harsh shadows, "
          + "harsh HDR, uncontrolled bloom, overexposure, plastic skin, low-detail faces, blurry eyes, "
          + "malformed anatomy, distorted hands, extra fingers, asymmetrical eyes, duplicated limbs, "
          + "inconsistent character appearance, montage, collage, split screen, contact sheet, multiple panels, "
          + "text, caption, subtitle, logo, watermark");

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
