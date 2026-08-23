package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface RenderInputSnapshotMapper extends NarrativeXMyBatisMapper {
  int insertHeader(
      @Param("generationJobId") Long generationJobId,
      @Param("projectId") Long projectId,
      @Param("chapterId") Long chapterId,
      @Param("chapterRowVersion") long chapterRowVersion,
      @Param("sourceHash") String sourceHash,
      @Param("mediaPlanId") UUID mediaPlanId,
      @Param("mediaPlanRevision") int mediaPlanRevision);

  int insertBeats(
      @Param("generationJobId") Long generationJobId,
      @Param("mediaPlanId") UUID mediaPlanId);

  int countPlanBeats(@Param("mediaPlanId") UUID mediaPlanId);

  boolean hasNarration(@Param("generationJobId") Long generationJobId);
}
