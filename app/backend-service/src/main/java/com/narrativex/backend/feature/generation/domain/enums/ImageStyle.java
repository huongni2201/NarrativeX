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
      "premium semi-realistic 3D CGI character rendering with a cinematic East Asian animated-feature and game-cutscene aesthetic, "
          + "approximately 70 percent realism and 30 percent anime-influenced stylization, never flat 2D illustration and never raw live-action photography, "
          + "idealized but believable character design while preserving canonical identity, apparent age, ethnicity, facial geometry and body proportions, "
          + "slender natural facial planes, a refined jawline and nose, proportional almond-shaped expressive eyes with layered iris detail, controlled catchlights and delicate natural eyelashes, "
          + "strand-level layered hair with fine flyaways, natural volume, a stable recognizable silhouette and restrained edge highlights, "
          + "physically based materials, soft subsurface skin scattering, luminous skin with subtle pores and natural tonal variation, never plastic or porcelain smooth, "
          + "canon-faithful wardrobe with intentional silhouette, premium fabric materials, readable weave and natural folds, "
          + "cinematic character-dominant composition using close-up, chest-up, waist-up or three-quarter framing when appropriate while preserving the requested camera direction, "
          + "soft physically coherent motivated light, gentle fill, subtle rim light around hair and shoulders, soft highlight roll-off and readable shadow detail, "
          + "restrained filmic color grading with a clear dominant palette, moderate contrast, natural skin tones and controlled saturation, "
          + "dimensional environments with atmospheric perspective, coherent spatial depth, shallow depth of field and creamy cinematic bokeh when the shot permits, "
          + "premium polished CGI finish with quiet emotional presence like a high-budget animated feature close-up rather than a beauty-filter portrait, "
          + "consistent face geometry, eye design, hair silhouette, body proportions, wardrobe state and location continuity across the series, "
          + "scene mood remains authoritative: romance, darkness, luxury, apocalypse, office, fantasy or action may change lighting and palette without changing the rendering language, "
          + "render the requested story scene only without book-cover typography, title text, banners, captions or decorative lettering",
      "raw live-action photograph, real human paparazzi photo, plain realistic portrait, ordinary office portrait, passport photo, corporate headshot, generic stock illustration, "
          + "flat 2D cel anime, 2.5D painterly illustration, thick black cartoon outlines, chibi, childish proportions, western superhero comic, flat vector art, watercolor-only rendering, rough sketch, "
          + "plastic toy look, porcelain doll skin, excessive pore detail, greasy skin, waxy skin, lifeless skin, low-detail face, blurry eyes, empty eyes, dull eyes, oversized eyes, generic stock anime face, "
          + "low-detail hair, flat hair mass, helmet hair, weak hair silhouette, beauty filter altering identity, unrequested makeup changes, age regression, age progression, "
          + "face redesign, hair recolor, costume redesign, unsupported accessories, "
          + "oversaturated colors, muddy colors, neon skin tones, flat front lighting, weak subject separation, harsh uncontrolled HDR, crushed shadow detail, blown highlights, "
          + "boring centered ID-photo composition, empty background with no story context, character too small in frame, weak visual hierarchy, "
          + "malformed anatomy, distorted hands, extra fingers, missing fingers, asymmetrical eyes, duplicated limbs, inconsistent character appearance, changing hairstyle, changing facial identity, changing outfit, "
          + "montage, collage, split screen, contact sheet, multiple panels, text, caption, subtitle, title, banner, decorative lettering, logo, watermark");

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
