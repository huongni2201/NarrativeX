package com.narrativex.backend.feature.account.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class JdbcQuotaReservation implements QuotaReservation {
  private final JdbcTemplate jdbcTemplate;

  @Override
  @Transactional
  public Optional<Reservation> reserve(
      String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs) {
    if (estimatedCost == null || estimatedCost.signum() < 0) {
      throw new IllegalArgumentException("estimatedCost must be non-negative");
    }

    List<BigDecimal> monthlyCredits =
        jdbcTemplate.query(
            """
            SELECT pe.monthly_credits
              FROM user_plan_assignments upa
              JOIN plan_entitlements pe
                ON pe.plan_key = upa.plan_key
               AND pe.version = upa.entitlement_version
             WHERE upa.user_id = ?
               AND upa.status = 'ACTIVE'
               AND (upa.period_start IS NULL OR upa.period_start <= CURRENT_DATE)
               AND (upa.period_end IS NULL OR upa.period_end >= CURRENT_DATE)
             ORDER BY pe.active_from DESC, pe.id DESC
             LIMIT 1
             FOR UPDATE OF upa
            """,
            (rs, rowNum) -> rs.getBigDecimal("monthly_credits"),
            userId);
    if (monthlyCredits.isEmpty()) {
      return Optional.empty();
    }

    String periodKey =
        jdbcTemplate.queryForObject("SELECT to_char(CURRENT_DATE, 'YYYY-MM')", String.class);
    if (periodKey == null) {
      throw new IllegalStateException("Could not resolve the current quota period");
    }

    jdbcTemplate.update(
        """
        INSERT INTO usage_windows (user_id, period_key)
        VALUES (?, ?)
        ON CONFLICT (user_id, period_key) DO NOTHING
        """,
        userId,
        periodKey);

    Integer activeReservations =
        jdbcTemplate.queryForObject(
            """
            SELECT count(*)
              FROM quota_reservations
             WHERE user_id = ?
               AND status = 'RESERVED'
            """,
            Integer.class,
            userId);
    if (activeReservations != null && activeReservations >= maxConcurrentExpensiveJobs) {
      return Optional.empty();
    }

    BigDecimal creditsUsed =
        jdbcTemplate.queryForObject(
            """
            SELECT credits_used
              FROM usage_windows
             WHERE user_id = ? AND period_key = ?
             FOR UPDATE
            """,
            BigDecimal.class,
            userId,
            periodKey);
    BigDecimal creditsReserved =
        jdbcTemplate.queryForObject(
            """
            SELECT COALESCE(SUM(estimated_cost), 0)
              FROM quota_reservations
             WHERE user_id = ?
               AND period_key = ?
               AND status = 'RESERVED'
            """,
            BigDecimal.class,
            userId,
            periodKey);

    BigDecimal committed = zeroIfNull(creditsUsed).add(zeroIfNull(creditsReserved));
    if (committed.add(estimatedCost).compareTo(monthlyCredits.getFirst()) > 0) {
      return Optional.empty();
    }

    Long reservationId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO quota_reservations
              (user_id, period_key, estimated_cost, status)
            VALUES (?, ?, ?, 'RESERVED')
            RETURNING id
            """,
            Long.class,
            userId,
            periodKey,
            estimatedCost);
    if (reservationId == null) {
      throw new IllegalStateException("Quota reservation insert returned no id");
    }
    return Optional.of(new Reservation(reservationId, userId, periodKey, estimatedCost));
  }

  @Override
  @Transactional
  public void bindToGenerationJob(long reservationId, long generationJobId) {
    int updated =
        jdbcTemplate.update(
            """
            UPDATE quota_reservations
               SET generation_job_id = ?,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE id = ?
               AND status = 'RESERVED'
               AND (generation_job_id IS NULL OR generation_job_id = ?)
            """,
            generationJobId,
            reservationId,
            generationJobId);
    if (updated != 1) {
      throw new IllegalStateException(
          "Quota reservation " + reservationId + " cannot be bound to job " + generationJobId);
    }
  }

  @Override
  @Transactional
  public boolean consumeForJob(long generationJobId) {
    return jdbcTemplate.update(
            """
            WITH consumed AS (
                UPDATE quota_reservations
                   SET status = 'CONSUMED',
                       finalized_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP,
                       row_version = row_version + 1
                 WHERE generation_job_id = ?
                   AND status = 'RESERVED'
                 RETURNING user_id, period_key, estimated_cost
            )
            UPDATE usage_windows uw
               SET credits_used = uw.credits_used + consumed.estimated_cost,
                   row_version = uw.row_version + 1
              FROM consumed
             WHERE uw.user_id = consumed.user_id
               AND uw.period_key = consumed.period_key
            """,
            generationJobId)
        == 1;
  }

  @Override
  @Transactional
  public boolean releaseForJob(long generationJobId) {
    return jdbcTemplate.update(
            """
            UPDATE quota_reservations
               SET status = 'RELEASED',
                   finalized_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   row_version = row_version + 1
             WHERE generation_job_id = ?
               AND status = 'RESERVED'
            """,
            generationJobId)
        == 1;
  }

  private static BigDecimal zeroIfNull(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value;
  }
}
