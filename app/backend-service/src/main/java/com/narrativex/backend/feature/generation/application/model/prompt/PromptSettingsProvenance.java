package com.narrativex.backend.feature.generation.application.model.prompt;

/**
 * Identifies the effective prompt configuration an operation was compiled with. The hash covers
 * only the effective content (active style and instructions), never timestamps or unused styles.
 */
public record PromptSettingsProvenance(long revision, String styleId, String effectiveHash) {}
