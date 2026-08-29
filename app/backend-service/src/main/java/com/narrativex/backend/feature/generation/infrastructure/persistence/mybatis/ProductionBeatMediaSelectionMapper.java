package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import com.narrativex.backend.feature.generation.domain.enums.BeatMediaFitMode;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProductionBeatMediaSelectionMapper extends NarrativeXMyBatisMapper {
  ProductionBeatSelectableAssetRow findSelectableAsset(
      @Param("projectId") UUID projectId,
      @Param("ownerId") String ownerId,
      @Param("mediaAssetId") UUID mediaAssetId);

  int upsert(
      @Param("projectId") UUID projectId,
      @Param("visualBeatId") UUID visualBeatId,
      @Param("mediaAssetId") UUID mediaAssetId,
      @Param("fitMode") BeatMediaFitMode fitMode,
      @Param("trimStartMs") long trimStartMs);

  int clear(
      @Param("projectId") UUID projectId, @Param("visualBeatId") UUID visualBeatId);
}
