package com.narrativex.backend.feature.account.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import java.math.BigDecimal;
import java.time.YearMonth;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcQuotaReservation implements QuotaReservation {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public boolean reserve(String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs) {
    String periodKey = YearMonth.now().toString();
    jdbcTemplate.update(
        """
        INSERT INTO usage_windows (user_id, period_key)
        VALUES (?, ?)
        ON CONFLICT (user_id, period_key) DO NOTHING
        """,
        userId,
        periodKey);

    return jdbcTemplate.update(
            """
            UPDATE usage_windows uw
               SET expensive_jobs_active = uw.expensive_jobs_active + 1,
                   credits_used = uw.credits_used + ?,
                   row_version = uw.row_version + 1
             WHERE uw.user_id = ?
               AND uw.period_key = ?
               AND uw.expensive_jobs_active < ?
               AND uw.credits_used + ? <= (
                   SELECT pe.monthly_credits
                     FROM user_plan_assignments upa
                     JOIN plan_entitlements pe
                       ON pe.plan_key = upa.plan_key
                      AND pe.version = upa.entitlement_version
                    WHERE upa.user_id = ?
                      AND upa.status = 'ACTIVE'
                      AND (upa.period_start IS NULL OR upa.period_start <= CURRENT_DATE)
                      AND (upa.period_end IS NULL OR upa.period_end >= CURRENT_DATE)
                    LIMIT 1
               )
            """,
            estimatedCost,
            userId,
            periodKey,
            maxConcurrentExpensiveJobs,
            estimatedCost,
            userId)
        == 1;
  }
}
