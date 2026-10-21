package com.narrativex.backend.feature.generation.application.port.out;

import java.util.Optional;
import java.util.UUID;

/**
 * Registers synthesized narration audio and its word alignment. A NarrationRequest owns at most one
 * current audio master; regenerating it replaces the audio and discards the alignment of the old
 * bytes, because timing is only meaningful for the exact audio it was measured on.
 */
public interface NarrationAssetRepository {
  /**
   * Makes {@code registration} the current audio of its request and returns the narration asset id.
   * Registering the audio that is already current is a no-op.
   */
  UUID register(Registration registration);

  Optional<NarrationAsset> findCurrentByMediaAssetId(UUID mediaAssetId);

  /** Stores the alignment once per asset and version; a repeat is ignored. */
  void saveAlignment(UUID narrationAssetId, String sourceHash, String version, String wordsJson);

  record Registration(
      UUID mediaAssetId,
      UUID projectId,
      UUID narrationRequestId,
      String storageKey,
      String name,
      String mimeType,
      long durationMs,
      long sizeBytes,
      String codec,
      int sampleRateHz,
      int channels,
      String checksum) {}

  record NarrationAsset(UUID id, UUID narrationRequestId, long durationMs, String sourceHash) {}
}
