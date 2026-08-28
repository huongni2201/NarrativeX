package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;

/** Produces the exact text sent to an image-generation provider. */
public final class VisualPromptText {
  private VisualPromptText() {}

  public static String finalPrompt(ComposedVisualPrompt composedPrompt) {
    return finalPrompt(composedPrompt.prompt(), composedPrompt.negativePrompt());
  }

  public static String finalPrompt(String prompt, String negativePrompt) {
    if (negativePrompt == null || negativePrompt.isBlank()) return prompt;
    return prompt + "\nAVOID: " + negativePrompt.trim();
  }
}
