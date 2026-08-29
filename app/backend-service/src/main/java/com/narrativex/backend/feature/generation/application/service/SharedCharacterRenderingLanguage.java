package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;

/** Shared premium character rendering rules for canonical references and storyboard frames. */
final class SharedCharacterRenderingLanguage {
  private SharedCharacterRenderingLanguage() {}

  static String blockFor(ImageStyle style) {
    if (style != ImageStyle.CINEMATIC_ANIME) return "";

    return """
        CHARACTER RENDERING LANGUAGE:
        - premium modern manhwa and webnovel promotional key-art quality
        - high-end 2.5D digital painting with polished Korean webtoon rendering quality
        - idealized mature protagonist proportions while preserving canonical identity
        - elegant refined facial planes and clearly constructed jawline
        - sharp expressive eyes with proportional scale, never oversized childish anime eyes
        - luminous layered iris detail with crisp, controlled catchlights
        - detailed eyelashes that remain natural and never doll-like
        - high-detail layered hair with individually readable strand groups, strong volume, and a stable recognizable silhouette
        - clean painterly illustrated skin with subtle tonal transitions, not photographic pore texture
        - premium wardrobe rendering with crisp folds and intentional silhouette
        - dimensional cinematic lighting with readable shadows, polished highlights, and controlled rim light
        - rich clean color separation with deep contrast and restrained accent colors
        - premium commercial manhwa cover-art finish even when the image is a storyboard scene

        FACE QUALITY PRIORITY:
        - if a character face is visible, render it with the same care as a standalone premium protagonist illustration
        - do not simplify facial anatomy, eye design, hair structure, or skin shading because the scene includes action or background
        - when the camera is close enough for the face to read clearly, facial fidelity is more important than generic stylization shortcuts

        ANTI-DRIFT:
        - do not enlarge the eyes
        - do not make the face rounder, younger, softer, or more childlike unless the canon explicitly requires it
        - do not collapse layered hair into flat helmet-like masses
        - do not switch to flat cel shading or generic anime simplification
        - do not reduce mature characters to teenage anime proportions
        - do not weaken the character into an ordinary generic office portrait or low-detail stock anime look
        """;
  }

  static void appendTo(StringBuilder prompt, ImageStyle style) {
    String block = blockFor(style);
    if (!block.isBlank()) {
      prompt.append('\n').append(block.stripTrailing());
    }
  }
}
