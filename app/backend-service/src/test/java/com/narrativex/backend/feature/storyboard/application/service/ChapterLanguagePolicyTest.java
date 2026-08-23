package com.narrativex.backend.feature.storyboard.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetection;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ChapterLanguagePolicyTest {
  private static final UUID VARIANT_ID = UuidV7.random();

  @Test
  void requiresConfirmationWhenConfidentDetectionDiffersFromProjectLanguage() {
    var detection =
        new LanguageDetection(
            1L, VARIANT_ID, "en", new BigDecimal("0.98"), "local", "a".repeat(64), Instant.now());

    assertThat(ChapterLanguagePolicy.translationStatus(detection, "vi-VN"))
        .isEqualTo("PENDING_CONFIRMATION");
  }

  @Test
  void doesNotRequireTranslationWhenLanguageMatchesProjectLocale() {
    var detection =
        new LanguageDetection(
            1L, VARIANT_ID, "vi", new BigDecimal("0.91"), "local", "a".repeat(64), Instant.now());

    assertThat(ChapterLanguagePolicy.translationStatus(detection, "vi-VN"))
        .isEqualTo("NOT_REQUIRED");
  }

  @Test
  void refusesToGuessLowConfidenceLanguage() {
    var detection =
        new LanguageDetection(
            1L, VARIANT_ID, "en", new BigDecimal("0.55"), "local", "a".repeat(64), Instant.now());

    assertThat(ChapterLanguagePolicy.translationStatus(detection, "vi"))
        .isEqualTo("LANGUAGE_SELECTION_REQUIRED");
  }
}
