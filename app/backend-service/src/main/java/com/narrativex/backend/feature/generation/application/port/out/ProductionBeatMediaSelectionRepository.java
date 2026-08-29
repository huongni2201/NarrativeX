package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import java.util.Optional;
import java.util.UUID;

public interface ProductionBeatMediaSelectionRepository {
  Optional<SelectableMediaAsset> findSelectableAsset(
      UUID projectId, String ownerId, UUID mediaAssetId);

  void upsert(
      UUID projectId,
      UUID visualBeatId,
      UUID mediaAssetId,
      BeatMediaFitMode fitMode,
      long trimStartMs);

  void clear(UUID projectId, UUID visualBeatId);

  record SelectableMediaAsset(
      UUID mediaAssetId,
      String mediaType,
      Long durationMs,
      long sizeBytes,
      String checksum) {}
}
