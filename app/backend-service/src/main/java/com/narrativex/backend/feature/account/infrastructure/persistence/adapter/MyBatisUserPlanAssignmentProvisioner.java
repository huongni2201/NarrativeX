package com.narrativex.backend.feature.account.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.account.infrastructure.persistence.mybatis.UserPlanAssignmentMapper;
import com.narrativex.backend.feature.common.application.port.out.UserPlanAssignmentProvisioner;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisUserPlanAssignmentProvisioner implements UserPlanAssignmentProvisioner {
  private final UserPlanAssignmentMapper mapper;

  @Override
  public void ensureDefaultAssignment(String userId) {
    if (mapper.assignmentExists(userId)) {
      return;
    }
    OffsetDateTime periodStart = OffsetDateTime.now(ZoneOffset.UTC);
    try {
      int inserted = mapper.insertDefaultAssignment(userId, periodStart, periodStart.plusMonths(1));
      if (inserted == 1 || mapper.assignmentExists(userId)) {
        return;
      }
    } catch (DataIntegrityViolationException exception) {
      if (mapper.assignmentExists(userId)) {
        return;
      }
      throw exception;
    }
    throw new IllegalStateException("Default plan entitlement NORMAL v1 is not configured");
  }
}
