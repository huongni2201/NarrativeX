package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface RenderInputSnapshotMapper extends NarrativeXMyBatisMapper {
  int insertHeader(
      @Param("generationJobId") UUID generationJobId,
      @Param("projectId") UUID projectId,
      @Param("chapterId") UUID chapterId,
      @Param("chapterRowVersion") long chapterRowVersion,
      @Param("sourceHash") String sourceHash,
      @Param("mediaPlanId") UUID mediaPlanId,
      @Param("mediaPlanRevision") int mediaPlanRevision);

  int insertBeats(
      @Param("generationJobId") UUID generationJobId, @Param("mediaPlanId") UUID mediaPlanId);

  int applyBeatOverride(
      @Param("generationJobId") UUID generationJobId,
      @Param("visualBeatId") UUID visualBeatId,
      @Param("durationMs") Long durationMs,
      @Param("cameraMovement") String cameraMovement);

  int countPlanBeats(@Param("mediaPlanId") UUID mediaPlanId);

  boolean hasNarration(@Param("generationJobId") UUID generationJobId);
}
