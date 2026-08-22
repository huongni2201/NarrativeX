package com.narrativex.backend.feature.account.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.OffsetDateTime;
import org.apache.ibatis.annotations.Param;

public interface UserPlanAssignmentMapper extends NarrativeXMyBatisMapper {
  boolean assignmentExists(@Param("userId") String userId);

  int insertDefaultAssignment(
      @Param("userId") String userId,
      @Param("periodStart") OffsetDateTime periodStart,
      @Param("periodEnd") OffsetDateTime periodEnd);
}
