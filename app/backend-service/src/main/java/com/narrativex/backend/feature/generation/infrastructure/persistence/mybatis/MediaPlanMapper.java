package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;
import java.util.UUID;

public interface MediaPlanMapper extends NarrativeXMyBatisMapper {
  Integer nextRevision(@Param("chapterId") Long chapterId);

  int insertPlan(MediaPlanRow row);

  int insertScene(MediaScenePlanRow row);

  int insertBeat(MediaBeatPlanRow row);

  boolean existsOwnedForChapter(
      @Param("mediaPlanId") UUID mediaPlanId,
      @Param("revision") int revision,
      @Param("chapterId") Long chapterId,
      @Param("ownerId") String ownerId);
}
