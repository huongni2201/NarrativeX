package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import com.narrativex.backend.feature.generation.domain.enums.VoiceReferenceScope;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NarrationRequestFingerprintTest {
  private final NarrationRequestFingerprint fingerprint = new NarrationRequestFingerprint();

  @Test
  void sameSnapshotAndVoiceProduceSameFingerprint() {
    UUID chapterId = UuidV7.random();
    String first =
        fingerprint.calculate(
            chapterId, 4L, "a".repeat(64), "voice-1", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String second =
        fingerprint.calculate(
            chapterId,
            4L,
            "a".repeat(64),
            "voice-1",
            "vi-VN",
            new BigDecimal("1.0"),
            "sentence-v1");

    assertThat(first).isEqualTo(second).hasSize(64);
  }

  @Test
  void sourceVoiceReferenceOrScopeChangeCreatesDifferentNarrationIdentity() {
    UUID chapterId = UuidV7.random();
    UUID referenceAssetId = UuidV7.random();
    String base =
        fingerprint.calculate(
            chapterId, 4L, "a".repeat(64), "voice-1", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String edited =
        fingerprint.calculate(
            chapterId, 5L, "b".repeat(64), "voice-1", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String otherVoice =
        fingerprint.calculate(
            chapterId, 4L, "a".repeat(64), "voice-2", "vi-VN", BigDecimal.ONE, "sentence-v1");
    String projectReference =
        fingerprint.calculate(
            chapterId,
            4L,
            "a".repeat(64),
            "voice-1",
            "vi-VN",
            BigDecimal.ONE,
            "sentence-v1",
            new VoiceReferenceSelection(VoiceReferenceScope.PROJECT, referenceAssetId));
    String accountReference =
        fingerprint.calculate(
            chapterId,
            4L,
            "a".repeat(64),
            "voice-1",
            "vi-VN",
            BigDecimal.ONE,
            "sentence-v1",
            new VoiceReferenceSelection(VoiceReferenceScope.ACCOUNT, referenceAssetId));

    assertThat(edited).isNotEqualTo(base);
    assertThat(otherVoice).isNotEqualTo(base);
    assertThat(projectReference).isNotEqualTo(base);
    assertThat(accountReference).isNotEqualTo(projectReference);
  }
}
