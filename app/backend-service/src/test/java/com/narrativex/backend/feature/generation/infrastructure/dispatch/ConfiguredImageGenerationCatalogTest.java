package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class ConfiguredImageGenerationCatalogTest {

  @Test
  void resolvesProviderModelAndOpaquePricingMetadataFromConfiguration() throws Exception {
    var catalog =
        new ConfiguredImageGenerationCatalog(
            new ObjectMapper(), "custom-provider", "custom-model", "pricing-v2", "BATCH");

    var profile = catalog.resolve("HIGH");

    assertThat(profile.providerKey()).isEqualTo("custom-provider");
    assertThat(profile.model()).isEqualTo("custom-model");
    var snapshot = new ObjectMapper().readTree(profile.pricingSnapshot());
    assertThat(snapshot.get("catalogVersion").asText()).isEqualTo("pricing-v2");
    assertThat(snapshot.get("tier").asText()).isEqualTo("HIGH");
    assertThat(snapshot.get("executionMode").asText()).isEqualTo("BATCH");
    assertThat(profile.pricingFingerprint()).hasSize(64);
  }

  @Test
  void pricingFingerprintChangesWithQualityTier() {
    var catalog =
        new ConfiguredImageGenerationCatalog(
            new ObjectMapper(), "vertex", "gemini-image", "pricing-v1", "BATCH");

    var standard = catalog.resolve("STANDARD");
    var high = catalog.resolve("HIGH");

    assertThat(standard.pricingFingerprint()).isNotEqualTo(high.pricingFingerprint());
    assertThat(catalog.resolve("STANDARD").pricingFingerprint())
        .isEqualTo(standard.pricingFingerprint());
  }
}
