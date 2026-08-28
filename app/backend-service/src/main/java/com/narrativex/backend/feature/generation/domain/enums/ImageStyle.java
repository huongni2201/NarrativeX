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
      "masterwork 2.5D digital painting, high-end romantic webnovel cover art illustration, "
          + "modern manhwa aesthetic, delicate semi-realistic character beauty with softly sculpted refined facial features, "
          + "smooth porcelain skin with soft airbrushed shading and radiant luminous glow, "
          + "large expressive glossy eyes with layered iris reflections, delicate eyelashes and brilliant catchlights, "
          + "silky voluminous flowing hair rendered with fine brushwork and soft golden specular sheen, "
          + "luxurious atmospheric lighting with a soft flattering key light, warm champagne gold rim lighting, "
          + "subtle romantic bloom, soft creamy bokeh with floating golden light motes and subtle sparkles in the background, "
          + "sophisticated deep color grading with rich espresso, charcoal, and warm amber tones, "
          + "polished digital illustration finish avoiding flat 2D anime and avoiding raw live-action photograph, "
          + "cohesive elegant romantic mood, consistent character appearance across the series, "
          + "render the requested story scene only, without book-cover typography, title text or decorative lettering",
      "raw live-action photograph, real human paparazzi photo, flat 2D cel anime, "
          + "thick black cartoon outlines, chibi, childish proportions, western superhero comic, "
          + "flat vector art, watercolor-only rendering, rough sketch, plastic toy look, waxy skin, "
          + "uncanny face, low-detail face, blurry eyes, empty eyes, neon oversaturation, muddy colors, "
          + "harsh flat lighting, crushed shadow detail, blown highlights, malformed anatomy, distorted hands, "
          + "extra fingers, missing fingers, asymmetrical eyes, duplicated limbs, inconsistent character appearance, "
          + "changing hairstyle, changing facial identity, changing outfit, montage, collage, split screen, "
          + "contact sheet, multiple panels, text, caption, subtitle, title, decorative lettering, logo, watermark");

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
