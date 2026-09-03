package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ConfiguredImageGenerationCatalogTest {

  @Test
  void resolvesProviderModelPricingAndEstimateFromOneCatalog() throws Exception {
    var catalog =
        new ConfiguredImageGenerationCatalog(
            new ObjectMapper(),
            "custom-provider",
            "custom-model",
            "pricing-v2",
            "BATCH",
            new BigDecimal("0.40"));

    var profile = catalog.resolve();

    assertThat(profile.providerKey()).isEqualTo("custom-provider");
    assertThat(profile.model()).isEqualTo("custom-model");
    assertThat(profile.unitCostUsd()).isEqualByComparingTo("0.40");
    assertThat(profile.estimateCost(3)).isEqualByComparingTo("1.200000");
    var snapshot = new ObjectMapper().readTree(profile.pricingSnapshot());
    assertThat(snapshot.get("catalogVersion").asText()).isEqualTo("pricing-v2");
    assertThat(snapshot.get("providerKey").asText()).isEqualTo("custom-provider");
    assertThat(snapshot.get("model").asText()).isEqualTo("custom-model");
    assertThat(snapshot.get("executionMode").asText()).isEqualTo("BATCH");
    assertThat(snapshot.get("unitCostUsd").asText()).isEqualTo("0.40");
    assertThat(snapshot.get("tier")).isNull();
    assertThat(profile.pricingFingerprint()).hasSize(64);
  }

  @Test
  void pricingFingerprintChangesWhenPricedExecutionIdentityChanges() {
    var base =
        new ConfiguredImageGenerationCatalog(
            new ObjectMapper(),
            "vertex",
            "gemini-image-a",
            "pricing-v1",
            "BATCH",
            new BigDecimal("0.40"));
    var differentModel =
        new ConfiguredImageGenerationCatalog(
            new ObjectMapper(),
            "vertex",
            "gemini-image-b",
            "pricing-v1",
            "BATCH",
            new BigDecimal("0.40"));
    var differentExecution =
        new ConfiguredImageGenerationCatalog(
            new ObjectMapper(),
            "vertex",
            "gemini-image-a",
            "pricing-v1",
            "ONLINE",
            new BigDecimal("0.40"));
    var differentCost =
        new ConfiguredImageGenerationCatalog(
            new ObjectMapper(),
            "vertex",
            "gemini-image-a",
            "pricing-v1",
            "BATCH",
            new BigDecimal("0.45"));

    var profile = base.resolve();

    assertThat(differentModel.resolve().pricingFingerprint())
        .isNotEqualTo(profile.pricingFingerprint());
    assertThat(differentExecution.resolve().pricingFingerprint())
        .isNotEqualTo(profile.pricingFingerprint());
    assertThat(differentCost.resolve().pricingFingerprint())
        .isNotEqualTo(profile.pricingFingerprint());
    assertThat(base.resolve().pricingFingerprint()).isEqualTo(profile.pricingFingerprint());
  }
}
