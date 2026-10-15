package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTargetAssignment;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ComputeTargetAssignmentMapper extends NarrativeXMyBatisMapper {
  int insert(ComputeTargetAssignment assignment);

  ComputeTargetAssignment find(@Param("taskId") UUID taskId, @Param("attemptId") UUID attemptId);
}
