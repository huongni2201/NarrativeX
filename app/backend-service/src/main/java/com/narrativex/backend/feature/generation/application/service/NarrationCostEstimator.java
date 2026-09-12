package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;

/** Compatibility estimate while monetary billing is disabled. */
@Component
public class NarrationCostEstimator {
  public NarrationCostEstimate estimate(String sourceText, boolean localExecution) {
    if (sourceText == null || sourceText.isBlank()) {
      throw new IllegalArgumentException("sourceText must not be blank");
    }
    long characters = sourceText.codePointCount(0, sourceText.length());
    BigDecimal zero = BigDecimal.ZERO.setScale(6);
    return new NarrationCostEstimate(characters, zero, zero, zero);
  }

  public NarrationCostEstimate estimate(String sourceText, String voiceId) {
    return estimate(sourceText, voiceId != null && voiceId.startsWith("vieneu-"));
  }

  public NarrationCostEstimate estimate(String sourceText) {
    return estimate(sourceText, false);
  }
}