package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ProductionBeatMediaSelectionRepository;
import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionBeatMediaSelectionMapper;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisProductionBeatMediaSelectionAdapter
    implements ProductionBeatMediaSelectionRepository {
  private final ProductionBeatMediaSelectionMapper mapper;

  @Override
  public Optional<SelectableMediaAsset> findSelectableAsset(
      UUID projectId, String ownerId, UUID mediaAssetId) {
    var row = mapper.findSelectableAsset(projectId, ownerId, mediaAssetId);
    if (row == null) return Optional.empty();
    return Optional.of(
        new SelectableMediaAsset(
            row.mediaAssetId(),
            row.mediaType(),
            row.storageMode(),
            row.durationMs(),
            row.sizeBytes(),
            row.checksum()));
  }

  @Override
  public void upsert(
      UUID projectId,
      UUID visualBeatId,
      UUID mediaAssetId,
      BeatMediaFitMode fitMode,
      long trimStartMs) {
    if (mapper.upsert(projectId, visualBeatId, mediaAssetId, fitMode, trimStartMs) != 1) {
      throw new IllegalStateException("Visual beat media selection was not persisted");
    }
  }

  @Override
  public void clear(UUID projectId, UUID visualBeatId) {
    mapper.clear(projectId, visualBeatId);
  }
}
