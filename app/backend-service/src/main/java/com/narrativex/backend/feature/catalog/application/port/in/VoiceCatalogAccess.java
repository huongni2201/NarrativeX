package com.narrativex.backend.feature.catalog.application.port.in;

import java.util.Optional;
import java.util.UUID;

public interface VoiceCatalogAccess {
  Optional<VoiceCapabilities> findVoice(String voiceId);

  record VoiceCapabilities(
      String id,
      String provider,
      boolean supportsSpeakingRate,
      boolean supportsVoiceClone,
      boolean supportsBatch,
      int sampleRateHz,
      String executionSemantics,
      String providerVoice,
      UUID referenceAssetId) {
    /** Name VieNeu resolves for catalog voices; falls back to the catalog ID. */
    public String synthesisVoiceName() {
      return providerVoice == null || providerVoice.isBlank() ? id : providerVoice;
    }

    public boolean localExecution() {
      return "LOCAL_RETRYABLE".equals(executionSemantics);
    }
  }
}
