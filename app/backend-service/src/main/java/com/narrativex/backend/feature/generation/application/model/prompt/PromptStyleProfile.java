package com.narrativex.backend.feature.generation.application.model.prompt;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.util.regex.Pattern;

/**
 * One selectable visual style. Preset ids (CINEMATIC, STORYBOOK_WATERCOLOR, CINEMATIC_ANIME) stay
 * stable; custom styles use any other id matching {@link #ID_PATTERN}.
 */
public record PromptStyleProfile(
    String id,
    String name,
    String positivePrompt,
    String negativePrompt,
    String characterRenderingPrompt) {
  public static final Pattern ID_PATTERN = Pattern.compile("[A-Za-z0-9_]{1,32}");
  public static final int MAX_NAME_LENGTH = 120;

  public PromptStyleProfile {
    if (id == null || !ID_PATTERN.matcher(id).matches()) {
      throw new DomainValidationException("styles.id: must match [A-Za-z0-9_]{1,32}");
    }
    String label = "styles[" + id + "]";
    name = PromptText.required(label + ".name", name, Integer.MAX_VALUE);
    if (name.length() > MAX_NAME_LENGTH) {
      throw new DomainValidationException(
          label + ".name: must be 1-" + MAX_NAME_LENGTH + " characters");
    }
    positivePrompt =
        PromptText.required(
            label + ".positivePrompt", positivePrompt, PromptSettings.MAX_BLOCK_BYTES);
    negativePrompt =
        PromptText.optional(
            label + ".negativePrompt", negativePrompt, PromptSettings.MAX_BLOCK_BYTES);
    characterRenderingPrompt =
        PromptText.optional(
            label + ".characterRenderingPrompt",
            characterRenderingPrompt,
            PromptSettings.MAX_BLOCK_BYTES);
  }

  int utf8Bytes() {
    return PromptText.utf8Bytes(name)
        + PromptText.utf8Bytes(positivePrompt)
        + PromptText.utf8Bytes(negativePrompt)
        + PromptText.utf8Bytes(characterRenderingPrompt);
  }
}
