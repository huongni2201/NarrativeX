package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Param;

public interface StageAttemptMapper extends NarrativeXMyBatisMapper {
  Long insert(StageAttemptRow row);

  StageAttemptRow findById(@Param("id") Long id);
}
