package com.narrativex.backend.feature.generation.application.port.out;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Resolves the single backend-authoritative image provider/model/pricing profile. */
public interface ImageGenerationCatalog {
  ImageGenerationProfile resolve();

  record ImageGenerationProfile(
      String profileVersion,
      String providerKey,
      String model,
      BigDecimal unitCostUsd,
      String pricingSnapshot,
      String pricingFingerprint) {

    public BigDecimal estimateCost(int imageCount) {
      if (imageCount < 0) {
        throw new IllegalArgumentException("imageCount must not be negative");
      }
      return unitCostUsd.multiply(BigDecimal.valueOf(imageCount)).setScale(6, RoundingMode.HALF_UP);
    }
  }
}
