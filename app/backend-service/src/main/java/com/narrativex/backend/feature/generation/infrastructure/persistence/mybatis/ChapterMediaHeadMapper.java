package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ChapterMediaHeadMapper extends NarrativeXMyBatisMapper {
  int upsert(
      @Param("chapterId") UUID chapterId,
      @Param("generationJobId") UUID generationJobId);

  boolean matchesCurrentPlan(
      @Param("chapterId") UUID chapterId,
      @Param("mediaPlanId") UUID mediaPlanId,
      @Param("mediaPlanRevision") int mediaPlanRevision);
}
