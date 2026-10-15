package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptStyleProfile;

/**
 * Appends the active style's editable character rendering instructions to character-reference and
 * video prompts. The prose lives in Prompt settings so a style change never leaves a hardcoded
 * rendering language (for example 3D CGI) behind.
 */
final class SharedCharacterRenderingLanguage {
  private SharedCharacterRenderingLanguage() {}

  static String blockFor(PromptStyleProfile style) {
    return style == null ? "" : style.characterRenderingPrompt();
  }

  static void appendTo(StringBuilder prompt, PromptStyleProfile style) {
    String block = blockFor(style);
    if (!block.isBlank()) {
      prompt.append('\n').append(block.stripTrailing());
    }
  }
}
