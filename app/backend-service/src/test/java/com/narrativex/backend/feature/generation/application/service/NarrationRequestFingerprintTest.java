package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NarrationRequestFingerprintTest {
  private final NarrationRequestFingerprint fingerprint = new NarrationRequestFingerprint();

  @Test
  void sameSnapshotAndVoiceProduceSameFingerprint() {
    String first =
        fingerprint.calculate(
            10L, 4L, "a".repeat(64), "voice-1", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String second =
        fingerprint.calculate(
            10L, 4L, "a".repeat(64), "voice-1", "vi-VN", new BigDecimal("1.0"), "sentence-v1");

    assertThat(first).isEqualTo(second).hasSize(64);
  }

  @Test
  void sourceOrVoiceChangeCreatesDifferentNarrationIdentity() {
    String base =
        fingerprint.calculate(
            10L, 4L, "a".repeat(64), "voice-1", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String edited =
        fingerprint.calculate(
            10L, 5L, "b".repeat(64), "voice-1", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String otherVoice =
        fingerprint.calculate(
            10L, 4L, "a".repeat(64), "voice-2", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String reference =
        fingerprint.calculate(
            10L,
            4L,
            "a".repeat(64),
            "voice-1",
            "vi-VN",
            BigDecimal.ONE,
            "sentence-v1",
            UUID.randomUUID());

    assertThat(edited).isNotEqualTo(base);
    assertThat(otherVoice).isNotEqualTo(base);
    assertThat(reference).isNotEqualTo(base);
  }
}
