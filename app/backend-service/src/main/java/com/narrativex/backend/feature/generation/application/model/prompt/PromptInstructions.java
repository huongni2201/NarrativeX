package com.narrativex.backend.feature.generation.application.model.prompt;

/**
 * Editable creative instruction blocks. They are plain text appended to backend-owned prompts and
 * can never replace the protected schema, identity, continuity or safety rules.
 */
public record PromptInstructions(
    String chapterAnalysis, String characterReference, String storyboard, String video) {

  public PromptInstructions {
    chapterAnalysis =
        PromptText.optional(
            "instructions.chapterAnalysis", chapterAnalysis, PromptSettings.MAX_BLOCK_BYTES);
    characterReference =
        PromptText.optional(
            "instructions.characterReference", characterReference, PromptSettings.MAX_BLOCK_BYTES);
    storyboard =
        PromptText.optional(
            "instructions.storyboard", storyboard, PromptSettings.MAX_BLOCK_BYTES);
    video = PromptText.optional("instructions.video", video, PromptSettings.MAX_BLOCK_BYTES);
  }

  int utf8Bytes() {
    return PromptText.utf8Bytes(chapterAnalysis)
        + PromptText.utf8Bytes(characterReference)
        + PromptText.utf8Bytes(storyboard)
        + PromptText.utf8Bytes(video);
  }
}
