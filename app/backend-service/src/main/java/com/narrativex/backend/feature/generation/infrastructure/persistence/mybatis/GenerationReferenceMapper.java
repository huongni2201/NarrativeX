package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface GenerationReferenceMapper extends NarrativeXMyBatisMapper {
  List<GenerationReferenceRow> findByShotId(@Param("shotId") UUID shotId);

  UUID insert(GenerationReferenceRow row);

  int insertBatch(@Param("refs") List<GenerationReferenceRow> refs);

  int deleteByShotId(@Param("shotId") UUID shotId);
}
