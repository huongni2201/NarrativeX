package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.stereotype.Component;

@Component
public class ChapterAnalysisCostEstimator {
  private static final BigDecimal MIN_COST = new BigDecimal("0.010000");
  private static final BigDecimal MAX_COST = new BigDecimal("0.050000");
  private static final BigDecimal AUTHORIZATION_MULTIPLIER = new BigDecimal("2.000000");

  public ChapterAnalysisCostEstimate estimate(String sourceText) {
    int tokens = Math.max(1, (sourceText.length() + 3) / 4);
    BigDecimal variable =
        BigDecimal.valueOf(tokens)
            .divide(BigDecimal.valueOf(10_000), 6, RoundingMode.UP)
            .multiply(new BigDecimal("0.040000"));
    BigDecimal estimateMax = MIN_COST.add(variable).min(MAX_COST).setScale(6);
    return new ChapterAnalysisCostEstimate(
        tokens, MIN_COST, estimateMax, estimateMax.multiply(AUTHORIZATION_MULTIPLIER));
  }
}
