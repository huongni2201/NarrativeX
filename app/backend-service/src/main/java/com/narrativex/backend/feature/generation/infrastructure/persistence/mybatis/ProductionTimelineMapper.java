package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProductionTimelineMapper extends NarrativeXMyBatisMapper {
  List<ProductionTimelineChapterRow> findChapters(
      @Param("projectId") UUID projectId, @Param("ownerId") String ownerId);

  List<ProductionTimelineBeatRow> findBeats(
      @Param("projectId") UUID projectId, @Param("ownerId") String ownerId);
}
