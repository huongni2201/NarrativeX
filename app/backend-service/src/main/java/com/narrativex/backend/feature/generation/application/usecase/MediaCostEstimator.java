package com.narrativex.backend.feature.generation.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Single pricing authority shared by estimate and media-job admission. */
public final class MediaCostEstimator {
  private MediaCostEstimator() {}

  public static BigDecimal unitCost(String qualityTier) {
    return switch (qualityTier) {
      case "DRAFT" -> new BigDecimal("0.10");
      case "HIGH" -> new BigDecimal("0.40");
      default -> new BigDecimal("0.25");
    };
  }

  public static BigDecimal estimate(String qualityTier, int visualBeatCount) {
    return unitCost(qualityTier)
        .multiply(BigDecimal.valueOf(visualBeatCount))
        .setScale(6, RoundingMode.HALF_UP);
  }
}
