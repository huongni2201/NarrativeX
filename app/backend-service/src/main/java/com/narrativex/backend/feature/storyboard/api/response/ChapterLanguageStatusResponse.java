package com.narrativex.backend.feature.storyboard.api.response;

import java.math.BigDecimal;
import java.util.UUID;

public record ChapterLanguageStatusResponse(
    UUID sourceVariantId,
    String detectedLanguage,
    BigDecimal confidence,
    String detector,
    String projectLanguage,
    String translationStatus,
    UUID existingTranslationVariantId) {}
