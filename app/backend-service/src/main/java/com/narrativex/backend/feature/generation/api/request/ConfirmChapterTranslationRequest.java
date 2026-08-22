package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;

public record ConfirmChapterTranslationRequest(
    Long sourceVariantId, @NotBlank String sourceContentHash, @NotBlank String targetLanguage) {}
