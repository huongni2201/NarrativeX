package com.narrativex.backend.feature.account.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.account.application.port.out.UserQuotaQueryRepository;
import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.account.application.query.UserQuotaView;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcUserQuotaQueryAdapter implements UserQuotaQueryRepository, UserQuotaAccess {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public Optional<UserQuotaView> findCurrent(String userId) {
    String periodKey = YearMonth.now().toString();
    return jdbcTemplate
        .query(
            """
            SELECT upa.plan_key,
                   upa.status,
                   upa.period_start,
                   upa.period_end,
                   pe.watermark_required,
                   pe.max_video_quality,
                   pe.max_longform_exports_month,
                   pe.max_short_exports_month,
                   pe.max_concurrent_expensive_jobs,
                   pe.monthly_credits,
                   pe.feature_flags_json::text AS feature_flags_json,
                   COALESCE(uw.longform_exports, 0) AS longform_exports,
                   COALESCE(uw.short_exports, 0) AS short_exports,
                   COALESCE(uw.expensive_jobs_active, 0) AS expensive_jobs_active,
                   COALESCE(uw.credits_used, 0) AS credits_used
              FROM user_plan_assignments upa
              JOIN plan_entitlements pe
                ON pe.plan_key = upa.plan_key
               AND pe.version = upa.entitlement_version
              LEFT JOIN usage_windows uw
                ON uw.user_id = upa.user_id
               AND uw.period_key = ?
             WHERE upa.user_id = ?
               AND upa.status = 'ACTIVE'
               AND (upa.period_start IS NULL OR upa.period_start <= CURRENT_DATE)
               AND (upa.period_end IS NULL OR upa.period_end >= CURRENT_DATE)
             ORDER BY pe.active_from DESC, pe.id DESC
             LIMIT 1
            """,
            (rs, rowNum) -> map(rs),
            periodKey,
            userId)
        .stream()
        .findFirst();
  }

  @Override
  public Optional<UserQuotaAccess.QuotaSnapshot> findCurrentQuota(String userId) {
    return findCurrent(userId)
        .map(
            quota ->
                new UserQuotaAccess.QuotaSnapshot(
                    quota.featureFlagsJson(),
                    quota.maxConcurrentExpensiveJobs(),
                    quota.expensiveJobsActive(),
                    quota.creditsUsed(),
                    quota.totalCredits()));
  }

  private static UserQuotaView map(ResultSet rs) throws SQLException {
    return new UserQuotaView(
        rs.getString("plan_key"),
        rs.getString("status"),
        localDate(rs, "period_start"),
        localDate(rs, "period_end"),
        rs.getBoolean("watermark_required"),
        rs.getString("max_video_quality"),
        (Integer) rs.getObject("max_longform_exports_month"),
        (Integer) rs.getObject("max_short_exports_month"),
        rs.getInt("max_concurrent_expensive_jobs"),
        rs.getString("feature_flags_json"),
        rs.getInt("longform_exports"),
        rs.getInt("short_exports"),
        rs.getInt("expensive_jobs_active"),
        defaultZero(rs.getBigDecimal("credits_used")),
        defaultZero(rs.getBigDecimal("monthly_credits")),
        defaultZero(rs.getBigDecimal("monthly_credits"))
            .subtract(defaultZero(rs.getBigDecimal("credits_used"))));
  }

  private static LocalDate localDate(ResultSet rs, String column) throws SQLException {
    var date = rs.getDate(column);
    return date == null ? null : date.toLocalDate();
  }

  private static BigDecimal defaultZero(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value;
  }
}
