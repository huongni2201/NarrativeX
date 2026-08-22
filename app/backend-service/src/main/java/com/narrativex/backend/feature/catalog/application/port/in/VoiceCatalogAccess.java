package com.narrativex.backend.feature.catalog.application.port.in;

import java.util.Optional;

public interface VoiceCatalogAccess {
  Optional<VoiceCapabilities> findVoice(String voiceId);

  record VoiceCapabilities(
      String id,
      String provider,
      boolean supportsSpeakingRate,
      boolean supportsVoiceClone,
      boolean supportsBatch,
      int sampleRateHz,
      String executionSemantics) {
    public boolean localExecution() {
      return "LOCAL_RETRYABLE".equals(executionSemantics);
    }
  }
}
