package com.narrativex.backend.feature.generation.application.port.out;

/** Server-owned execution profile for API image generation. Pricing is intentionally not modeled. */
public interface ImageGenerationCatalog {
  ImageGenerationProfile resolve();

  record ImageGenerationProfile(String providerKey, String model) {}
}
