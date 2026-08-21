package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface MediaPlanMapper extends NarrativeXMyBatisMapper {
  Integer nextRevision(@Param("chapterId") Long chapterId);

  int insertPlan(MediaPlanRow row);

  int insertScene(MediaScenePlanRow row);

  int insertBeat(MediaBeatPlanRow row);
}
