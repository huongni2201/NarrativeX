package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.stereotype.Component;

/**
 * Admission-only conservative ceiling. Actual provider usage remains authoritative for settlement.
 * Local VieNeu execution consumes concurrency capacity but has no external API dollar charge.
 */
@Component
public class NarrationCostEstimator {
  private static final BigDecimal AUTHORIZATION_USD_PER_1K_CHARACTERS = new BigDecimal("0.160000");
  private static final BigDecimal AUTHORIZATION_MULTIPLIER = new BigDecimal("1.250000");

  public NarrationCostEstimate estimate(String sourceText, boolean localExecution) {
    if (sourceText == null || sourceText.isBlank()) {
      throw new IllegalArgumentException("sourceText must not be blank");
    }
    long characters = sourceText.codePointCount(0, sourceText.length());
    if (localExecution) {
      BigDecimal zero = BigDecimal.ZERO.setScale(6);
      return new NarrationCostEstimate(characters, zero, zero, zero);
    }
    BigDecimal estimateMax =
        BigDecimal.valueOf(characters)
            .divide(BigDecimal.valueOf(1000), 6, RoundingMode.UP)
            .multiply(AUTHORIZATION_USD_PER_1K_CHARACTERS)
            .setScale(6, RoundingMode.UP);
    BigDecimal maxAuthorized =
        estimateMax.multiply(AUTHORIZATION_MULTIPLIER).setScale(6, RoundingMode.UP);
    return new NarrationCostEstimate(
        characters, BigDecimal.ZERO.setScale(6), estimateMax, maxAuthorized);
  }

  public NarrationCostEstimate estimate(String sourceText, String voiceId) {
    return estimate(sourceText, voiceId != null && voiceId.startsWith("vieneu-"));
  }

  public NarrationCostEstimate estimate(String sourceText) {
    return estimate(sourceText, false);
  }
}
