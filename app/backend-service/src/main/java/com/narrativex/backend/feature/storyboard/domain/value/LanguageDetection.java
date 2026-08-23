package com.narrativex.backend.feature.storyboard.domain.value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record LanguageDetection(
    Long id,
    UUID contentVariantId,
    String detectedLanguage,
    BigDecimal confidence,
    String detector,
    String contentHash,
    Instant detectedAt) {}
