package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface ChapterAnalysisSafetyMapper extends NarrativeXMyBatisMapper {
  String findLatestModerationResult(
      @Param("projectId") Long projectId, @Param("chapterId") Long chapterId);
}
