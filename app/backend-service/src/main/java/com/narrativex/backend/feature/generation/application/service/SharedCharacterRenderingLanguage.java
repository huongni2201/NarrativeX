package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;

/** Shared premium character rendering rules for canonical references and storyboard frames. */
final class SharedCharacterRenderingLanguage {
  private SharedCharacterRenderingLanguage() {}

  static String blockFor(ImageStyle style) {
    if (style != ImageStyle.CINEMATIC_ANIME) return "";

    return """
        CHARACTER RENDERING LANGUAGE:
        - premium semi-realistic 3D CGI, like a high-budget East Asian animated feature or cinematic game cutscene
        - balance approximately 70 percent believable realism with 30 percent anime-influenced idealization
        - preserve canonical identity, apparent age, ethnicity, facial geometry, body proportions, and permanent traits
        - elegant but believable facial planes with a natural refined jawline, chin, nose, lips, ears, and hairline
        - proportional almond-shaped expressive eyes, never oversized childish anime eyes
        - moist layered irises with restrained, physically coherent catchlights and natural eyelashes
        - strand-level layered hair with fine flyaways, natural volume, and a stable recognizable silhouette
        - physically based materials and soft subsurface skin scattering with subtle pores and natural tonal variation
        - detailed wardrobe materials with readable weave, natural folds, and a canon-faithful silhouette
        - soft cinematic motivated light, gentle fill, subtle rim light, readable shadows, and soft highlight roll-off
        - restrained filmic color grading, moderate contrast, natural skin tones, and controlled saturation
        - dimensional cinematic depth with atmospheric perspective and creamy bokeh when the requested shot permits it

        FACE QUALITY PRIORITY:
        - if a character face is visible, render it with the same care as a premium animated-feature close-up
        - do not simplify facial anatomy, eye design, hair structure, or skin shading because the scene includes action or background
        - when the camera is close enough for the face to read clearly, facial fidelity is more important than generic stylization shortcuts

        ANTI-DRIFT:
        - do not enlarge the eyes
        - do not make the face rounder, younger, softer, or more childlike unless the canon explicitly requires it
        - do not collapse layered hair into flat helmet-like masses
        - do not switch to flat cel shading, 2.5D painterly illustration, or generic anime simplification
        - do not reduce mature characters to teenage anime proportions
        - do not drift into raw live-action photography, plastic doll CGI, a beauty-filter portrait, or low-detail stock anime
        """;
  }

  static void appendTo(StringBuilder prompt, ImageStyle style) {
    String block = blockFor(style);
    if (!block.isBlank()) {
      prompt.append('\n').append(block.stripTrailing());
    }
  }
}
