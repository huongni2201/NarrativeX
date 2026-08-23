package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ConfirmChapterTranslationRequest(
    UUID sourceVariantId, @NotBlank String sourceContentHash, @NotBlank String targetLanguage) {}
