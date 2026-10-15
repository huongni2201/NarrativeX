package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterProductionStatusMapper extends NarrativeXMyBatisMapper {
  ChapterProductionStatusRow aggregate(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);

  List<ShotStrategyGroupRow> shotStrategyGroups(
      @Param("projectId") UUID projectId, @Param("chapterId") UUID chapterId);
}
