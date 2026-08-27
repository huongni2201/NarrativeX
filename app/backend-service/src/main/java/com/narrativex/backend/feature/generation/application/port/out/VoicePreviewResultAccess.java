package com.narrativex.backend.feature.generation.application.port.out;

import java.util.UUID;

public interface VoicePreviewResultAccess {
  VoicePreviewResult findCompleted(String ownerId, UUID projectId, UUID jobId);

  record VoicePreviewResult(String storageKey, String contentType, long durationMs) {}
}
