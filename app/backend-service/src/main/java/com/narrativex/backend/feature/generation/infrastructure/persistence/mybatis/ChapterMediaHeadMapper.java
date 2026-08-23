package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface ChapterMediaHeadMapper extends NarrativeXMyBatisMapper {
  int upsert(
      @Param("chapterId") Long chapterId,
      @Param("generationJobId") Long generationJobId);
}
