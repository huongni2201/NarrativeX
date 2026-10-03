package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface MediaGenerationItemMapper extends NarrativeXMyBatisMapper {
  UUID insert(MediaGenerationItemRow row);

  MediaGenerationItemRow findById(@Param("id") UUID id);

  List<MediaGenerationItemRow> findByJobId(@Param("jobId") UUID jobId);

  int bindLeaf(@Param("id") UUID id, @Param("leafJobId") UUID leafJobId, @Param("takeId") UUID takeId);

  int updateExecution(@Param("id") UUID id, @Param("status") String status,
      @Param("assetId") UUID assetId, @Param("errorCode") String errorCode);

  int review(
      @Param("id") UUID id,
      @Param("rowVersion") long rowVersion,
      @Param("decision") String decision);
}
