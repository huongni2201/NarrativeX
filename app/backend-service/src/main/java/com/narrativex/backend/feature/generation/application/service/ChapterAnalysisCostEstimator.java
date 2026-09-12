package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;

/** Compatibility estimate while monetary billing is disabled. */
@Component
public class ChapterAnalysisCostEstimator {
  public ChapterAnalysisCostEstimate estimate(String sourceText) {
    int tokens = Math.max(1, (sourceText.length() + 3) / 4);
    BigDecimal zero = BigDecimal.ZERO.setScale(6);
    return new ChapterAnalysisCostEstimate(tokens, zero, zero, zero);
  }
}