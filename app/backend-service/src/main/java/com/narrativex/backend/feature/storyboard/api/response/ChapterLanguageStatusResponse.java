package com.narrativex.backend.feature.storyboard.api.response;

import java.math.BigDecimal;

public record ChapterLanguageStatusResponse(
    Long sourceVariantId,
    String detectedLanguage,
    BigDecimal confidence,
    String detector,
    String projectLanguage,
    String translationStatus,
    Long existingTranslationVariantId) {}
