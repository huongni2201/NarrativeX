package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface OperationPlanMapper extends NarrativeXMyBatisMapper {
  UUID insert(OperationPlanRow row);

  int updateCas(OperationPlanRow row);

  OperationPlanRow findById(@Param("id") UUID id);
}
