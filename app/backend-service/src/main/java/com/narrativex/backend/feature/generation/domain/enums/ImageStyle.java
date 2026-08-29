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
      "masterwork 2.5D digital painting, premium semi-realistic modern manhwa and cinematic webnovel illustration, "
          + "refined painterly rendering with natural age-appropriate facial structure and clearly modeled facial planes, "
          + "expressive proportionate eyes with layered iris detail, delicate eyelashes and readable catchlights, "
          + "detailed layered hair strands with a stable recognizable silhouette, natural anatomical proportions and subtle skin shading, "
          + "consistent face geometry and character identity across the series, "
          + "cinematic physically motivated lighting appropriate to the requested scene with controlled highlights and readable shadow detail, "
          + "subtle atmospheric depth and bloom only when appropriate to the story moment, "
          + "rich cinematic color grading adapted to the scene mood with controlled saturation, "
          + "detailed painterly environments with coherent spatial depth and atmospheric perspective, "
          + "polished digital illustration finish avoiding flat 2D anime and avoiding raw live-action photography, "
          + "preserve established face, body proportions, hair silhouette, wardrobe state and location continuity, "
          + "do not force romantic, golden, glamorous or beauty-shot lighting when incompatible with the scene, "
          + "render the requested story scene only without book-cover typography, title text or decorative lettering",
      "raw live-action photograph, real human paparazzi photo, flat 2D cel anime, "
          + "thick black cartoon outlines, chibi, childish proportions, western superhero comic, "
          + "flat vector art, watercolor-only rendering, rough sketch, plastic toy look, waxy skin, "
          + "uncanny face, low-detail face, blurry eyes, empty eyes, generic stock anime face, beauty filter altering identity, "
          + "unrequested makeup changes, age regression, age progression, face redesign, hair recolor, costume redesign, "
          + "neon oversaturation, muddy colors, harsh flat lighting, crushed shadow detail, blown highlights, "
          + "malformed anatomy, distorted hands, extra fingers, missing fingers, asymmetrical eyes, duplicated limbs, "
          + "inconsistent character appearance, changing hairstyle, changing facial identity, changing outfit, "
          + "montage, collage, split screen, contact sheet, multiple panels, text, caption, subtitle, title, "
          + "decorative lettering, logo, watermark");

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
