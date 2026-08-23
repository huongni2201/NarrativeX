package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConfiguredImageGenerationCatalog implements ImageGenerationCatalog {
  private final ObjectMapper objectMapper;
  private final String providerKey;
  private final String model;
  private final String pricingVersion;
  private final String executionMode;

  public ConfiguredImageGenerationCatalog(
      ObjectMapper objectMapper,
      @Value("${narrativex.generation.image.provider-key}") String providerKey,
      @Value("${narrativex.generation.image.model}") String model,
      @Value("${narrativex.generation.image.pricing-version}") String pricingVersion,
      @Value("${narrativex.generation.image.execution-mode}") String executionMode) {
    this.objectMapper = objectMapper;
    this.providerKey = requireText(providerKey, "providerKey");
    this.model = requireText(model, "model");
    this.pricingVersion = requireText(pricingVersion, "pricingVersion");
    this.executionMode = requireText(executionMode, "executionMode");
  }

  @Override
  public ImageGenerationProfile resolve(String qualityTier) {
    String normalizedTier = requireText(qualityTier, "qualityTier");
    Map<String, String> snapshot = new LinkedHashMap<>();
    snapshot.put("catalogVersion", pricingVersion);
    snapshot.put("tier", normalizedTier);
    snapshot.put("executionMode", executionMode);
    try {
      return new ImageGenerationProfile(
          providerKey,
          model,
          objectMapper.writeValueAsString(snapshot),
          sha256(pricingVersion + ":" + normalizedTier));
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Could not serialize image pricing snapshot", exception);
    }
  }

  private static String requireText(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value.trim();
  }

  private static String sha256(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
