package com.narrativex.backend.feature.generation.application.model.prompt;

/**
 * Prompts a preview compiled. {@code prompt} and {@code negativePrompt} are the separate provider
 * fields; {@code finalText} is the single string when the provider takes one (image providers).
 */
public record PromptPreviewResult(String prompt, String negativePrompt, String finalText) {}
