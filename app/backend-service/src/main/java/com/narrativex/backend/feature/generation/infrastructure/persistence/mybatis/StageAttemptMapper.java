package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface StageAttemptMapper extends NarrativeXMyBatisMapper {
  UUID insert(StageAttemptRow row);

  StageAttemptRow findById(@Param("id") UUID id);
}
