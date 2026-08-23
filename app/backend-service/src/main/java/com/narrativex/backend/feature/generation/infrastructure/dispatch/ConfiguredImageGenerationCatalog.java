package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import java.math.BigDecimal;
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
  private final BigDecimal draftUnitCost;
  private final BigDecimal standardUnitCost;
  private final BigDecimal highUnitCost;

  public ConfiguredImageGenerationCatalog(
      ObjectMapper objectMapper,
      @Value("${narrativex.generation.image.provider-key}") String providerKey,
      @Value("${narrativex.generation.image.model}") String model,
      @Value("${narrativex.generation.image.pricing-version}") String pricingVersion,
      @Value("${narrativex.generation.image.execution-mode}") String executionMode,
      @Value("${narrativex.generation.image.unit-cost-draft}") BigDecimal draftUnitCost,
      @Value("${narrativex.generation.image.unit-cost-standard}") BigDecimal standardUnitCost,
      @Value("${narrativex.generation.image.unit-cost-high}") BigDecimal highUnitCost) {
    this.objectMapper = objectMapper;
    this.providerKey = requireText(providerKey, "providerKey");
    this.model = requireText(model, "model");
    this.pricingVersion = requireText(pricingVersion, "pricingVersion");
    this.executionMode = requireText(executionMode, "executionMode");
    this.draftUnitCost = requireCost(draftUnitCost, "draftUnitCost");
    this.standardUnitCost = requireCost(standardUnitCost, "standardUnitCost");
    this.highUnitCost = requireCost(highUnitCost, "highUnitCost");
  }

  @Override
  public ImageGenerationProfile resolve(String qualityTier) {
    String normalizedTier = requireText(qualityTier, "qualityTier").toUpperCase();
    BigDecimal unitCost = unitCost(normalizedTier);
    Map<String, String> snapshot = new LinkedHashMap<>();
    snapshot.put("catalogVersion", pricingVersion);
    snapshot.put("providerKey", providerKey);
    snapshot.put("model", model);
    snapshot.put("tier", normalizedTier);
    snapshot.put("executionMode", executionMode);
    snapshot.put("unitCostUsd", unitCost.toPlainString());
    try {
      String pricingSnapshot = objectMapper.writeValueAsString(snapshot);
      return new ImageGenerationProfile(
          providerKey, model, unitCost, pricingSnapshot, sha256(pricingSnapshot));
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Could not serialize image pricing snapshot", exception);
    }
  }

  private BigDecimal unitCost(String tier) {
    return switch (tier) {
      case "DRAFT" -> draftUnitCost;
      case "HIGH" -> highUnitCost;
      default -> standardUnitCost;
    };
  }

  private static String requireText(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " must not be blank");
    }
    return value.trim();
  }

  private static BigDecimal requireCost(BigDecimal value, String field) {
    if (value == null || value.signum() < 0) {
      throw new IllegalArgumentException(field + " must not be negative");
    }
    return value;
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
