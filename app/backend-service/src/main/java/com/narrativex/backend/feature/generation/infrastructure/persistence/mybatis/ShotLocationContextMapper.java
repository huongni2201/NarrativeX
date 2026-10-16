package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ShotLocationContextMapper extends NarrativeXMyBatisMapper {
  List<ShotLocationContextRow> findForShots(
      @Param("projectId") UUID projectId, @Param("shotIds") List<UUID> shotIds);
}
