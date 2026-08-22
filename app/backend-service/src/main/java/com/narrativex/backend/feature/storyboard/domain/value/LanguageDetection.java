package com.narrativex.backend.feature.storyboard.domain.value;

import java.math.BigDecimal;
import java.time.Instant;

public record LanguageDetection(
    Long id,
    Long contentVariantId,
    String detectedLanguage,
    BigDecimal confidence,
    String detector,
    String contentHash,
    Instant detectedAt) {}
