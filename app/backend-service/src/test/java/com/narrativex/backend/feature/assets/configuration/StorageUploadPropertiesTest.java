package com.narrativex.backend.feature.assets.configuration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class StorageUploadPropertiesTest {
  @Test
  void rejectsTtlBelowOneMinute() {
    assertThatThrownBy(() -> new StorageUploadProperties(Duration.ofSeconds(59)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsTtlAboveSevenDays() {
    assertThatThrownBy(() -> new StorageUploadProperties(Duration.ofDays(7).plusSeconds(1)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void acceptsProductDefault() {
    new StorageUploadProperties(Duration.ofMinutes(15));
  }
}
