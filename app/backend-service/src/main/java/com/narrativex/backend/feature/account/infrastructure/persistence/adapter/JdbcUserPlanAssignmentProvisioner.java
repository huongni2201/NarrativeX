package com.narrativex.backend.feature.account.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.account.application.port.out.UserPlanAssignmentProvisioner;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcUserPlanAssignmentProvisioner implements UserPlanAssignmentProvisioner {
  private static final String DEFAULT_PLAN_KEY = "NORMAL";
  private static final int DEFAULT_ENTITLEMENT_VERSION = 1;

  private final JdbcTemplate jdbcTemplate;

  @Override
  public void ensureDefaultAssignment(String userId) {
    if (assignmentExists(userId)) {
      return;
    }

    OffsetDateTime periodStart = OffsetDateTime.now(ZoneOffset.UTC);
    try {
      int inserted =
          jdbcTemplate.update(
              """
              INSERT INTO user_plan_assignments
                (user_id, plan_key, entitlement_version, status, period_start, period_end)
              SELECT ?, pe.plan_key, pe.version, 'ACTIVE', ?, ?
                FROM plan_entitlements pe
               WHERE pe.plan_key = ?
                 AND pe.version = ?
              """,
              userId,
              periodStart,
              periodStart.plusMonths(1),
              DEFAULT_PLAN_KEY,
              DEFAULT_ENTITLEMENT_VERSION);

      if (inserted == 1 || assignmentExists(userId)) {
        return;
      }
    } catch (DataIntegrityViolationException exception) {
      if (assignmentExists(userId)) {
        return;
      }
      throw exception;
    }

    throw new IllegalStateException("Default plan entitlement NORMAL v1 is not configured");
  }

  private boolean assignmentExists(String userId) {
    Boolean exists =
        jdbcTemplate.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM user_plan_assignments WHERE user_id = ?)",
            Boolean.class,
            userId);
    return Boolean.TRUE.equals(exists);
  }
}
