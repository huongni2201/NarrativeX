package com.narrativex.backend.feature.generation.application.port.out;

/** Resolves the backend-authoritative image provider/model/pricing profile for a media job. */
public interface ImageGenerationCatalog {
  ImageGenerationProfile resolve(String qualityTier);

  record ImageGenerationProfile(
      String providerKey, String model, String pricingSnapshot, String pricingFingerprint) {}
}
