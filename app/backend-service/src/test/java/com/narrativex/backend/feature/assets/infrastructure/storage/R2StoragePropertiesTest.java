package com.narrativex.backend.feature.assets.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class R2StoragePropertiesTest {
  @Test
  void rejectsMalformedConfiguredEndpoint() {
    R2StorageProperties properties =
        new R2StorageProperties(
            "account", "access", "secret", "bucket", "R2_ENDPOINT=https://example.com");

    assertThat(properties.configured()).isFalse();
  }

  @Test
  void acceptsHttpsEndpoint() {
    R2StorageProperties properties =
        new R2StorageProperties("account", "access", "secret", "bucket", "https://example.com");

    assertThat(properties.configured()).isTrue();
  }
}
