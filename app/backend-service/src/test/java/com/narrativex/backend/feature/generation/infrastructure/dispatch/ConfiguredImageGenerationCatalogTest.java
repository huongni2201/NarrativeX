package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ConfiguredImageGenerationCatalogTest {

  @Test
  void resolvesProviderAndModelWithoutPricingMetadata() {
    var catalog = new ConfiguredImageGenerationCatalog("custom-provider", "custom-model");

    var profile = catalog.resolve();

    assertThat(profile.providerKey()).isEqualTo("custom-provider");
    assertThat(profile.model()).isEqualTo("custom-model");
  }

  @Test
  void rejectsBlankExecutionIdentity() {
    assertThatThrownBy(() -> new ConfiguredImageGenerationCatalog(" ", "model"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("providerKey");
    assertThatThrownBy(() -> new ConfiguredImageGenerationCatalog("vertex", " "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("model");
  }
}
