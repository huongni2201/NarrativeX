package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface HookPlanMapper extends NarrativeXMyBatisMapper {
  HookPlanRow findByChapterId(@Param("chapterId") UUID chapterId);

  HookPlanRow findById(@Param("id") UUID id);

  UUID insert(HookPlanRow row);

  int update(HookPlanRow row);

  int deleteByChapterId(@Param("chapterId") UUID chapterId);
}
