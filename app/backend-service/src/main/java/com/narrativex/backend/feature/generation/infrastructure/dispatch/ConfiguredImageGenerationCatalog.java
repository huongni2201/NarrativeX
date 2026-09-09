package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConfiguredImageGenerationCatalog implements ImageGenerationCatalog {
  private final String providerKey;
  private final String model;

  public ConfiguredImageGenerationCatalog(
      @Value("${narrativex.generation.image.provider-key}") String providerKey,
      @Value("${narrativex.generation.image.model}") String model) {
    this.providerKey = requireText(providerKey, "providerKey");
    this.model = requireText(model, "model");
  }

  @Override
  public ImageGenerationProfile resolve() {
    return new ImageGenerationProfile(providerKey, model);
  }

  private static String requireText(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value.trim();
  }
}
