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
      "premium modern manhwa and webnovel cover illustration, high-end 2.5D digital painting with polished Korean webtoon key-art quality, "
          + "idealized protagonist design while preserving canonical identity, age, ethnicity, facial geometry and body proportions, "
          + "clean elegant facial planes, refined jawline and nose construction, sharp expressive eyes with luminous layered iris detail, crisp catchlights and delicate eyelashes, "
          + "high-detail layered hair with individual readable strands, strong volume, a stable recognizable silhouette and controlled glossy highlights, "
          + "clean illustrated skin with refined painterly shading and subtle tonal variation rather than photographic skin texture, "
          + "fashion-forward wardrobe with intentional silhouette, premium fabric rendering, crisp folds, tasteful accessories and memorable main-character styling when compatible with canon, "
          + "strong main-character presence and immediately readable silhouette, visually striking even at thumbnail size, "
          + "cinematic character-dominant composition using chest-up, waist-up or three-quarter framing when appropriate while preserving the requested camera direction, "
          + "dramatic but physically coherent lighting with strong subject-background separation, controlled rim lighting, polished highlights and readable shadow detail, "
          + "rich high-contrast color design with a clear dominant palette and restrained accent colors, clean saturation, luminous highlights and no muddy midtones, "
          + "detailed painterly environments with atmospheric perspective, coherent spatial depth and enough detail to establish story context without competing with the characters, "
          + "premium commercial illustration finish, emotionally charged and visually magnetic like polished webnovel promotional art rather than an ordinary portrait, "
          + "consistent face geometry, eye design, hair silhouette, body proportions, wardrobe state and location continuity across the series, "
          + "scene mood remains authoritative: romance, darkness, luxury, apocalypse, office, fantasy or action may change lighting and palette without changing the rendering language, "
          + "render the requested story scene only without book-cover typography, title text, banners, captions or decorative lettering",
      "raw live-action photograph, real human paparazzi photo, plain realistic portrait, ordinary office portrait, passport photo, corporate headshot, generic stock illustration, "
          + "flat 2D cel anime, thick black cartoon outlines, chibi, childish proportions, western superhero comic, flat vector art, watercolor-only rendering, rough sketch, "
          + "plastic toy look, photographic pores, greasy realistic skin, waxy skin, lifeless skin, low-detail face, blurry eyes, empty eyes, dull eyes, generic stock anime face, "
          + "low-detail hair, flat hair mass, helmet hair, weak hair silhouette, beauty filter altering identity, unrequested makeup changes, age regression, age progression, "
          + "face redesign, hair recolor, costume redesign, bland casual styling, generic everyday clothing, weak protagonist styling, "
          + "washed-out colors, muddy colors, gray dull palette, flat front lighting, weak subject separation, harsh uncontrolled HDR, crushed shadow detail, blown highlights, "
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
