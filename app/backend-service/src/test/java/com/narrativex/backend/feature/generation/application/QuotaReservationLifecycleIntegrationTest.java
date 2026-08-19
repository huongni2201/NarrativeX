package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class QuotaReservationLifecycleIntegrationTest {
  private static final String USER_ID = "quota-lifecycle-test-user";
  private static final String PLAN_KEY = "QUOTA_LIFECYCLE_TEST";

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("narrativex_quota_test")
          .withUsername("narrativex")
          .withPassword("narrativex");

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.data.redis.repositories.enabled", () -> false);
  }

  @Autowired private QuotaReservation quotaReservation;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void completedJobConsumesReservationAndImmediatelyFreesConcurrentCapacity() {
    seedEntitlement();
    long projectId = insertProject();
    List<Long> jobIds = new ArrayList<>();

    for (int index = 0; index < 4; index++) {
      var reservation =
          quotaReservation.reserve(USER_ID, new BigDecimal("1.000000"), 4).orElseThrow();
      long jobId = insertJob(projectId, "complete-slot-" + index);
      quotaReservation.bindToGenerationJob(reservation.id(), jobId);
      jobIds.add(jobId);
    }

    assertTrue(
        quotaReservation.reserve(USER_ID, new BigDecimal("1.000000"), 4).isEmpty(),
        "The fifth active expensive job must be rejected while four reservations are RESERVED");

    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?",
        jobIds.getFirst());

    assertEquals("CONSUMED", reservationStatus(jobIds.getFirst()));
    assertEquals(3, activeReservations());
    assertEquals(0, new BigDecimal("1.000000").compareTo(creditsUsed()));

    assertTrue(
        quotaReservation.reserve(USER_ID, new BigDecimal("1.000000"), 4).isPresent(),
        "A completed job must free its concurrent slot");
  }

  @Test
  void failedJobReleasesReservationWithoutChargingCreditsAndRetryIsIdempotent() {
    seedEntitlement();
    long projectId = insertProject();
    var reservation =
        quotaReservation.reserve(USER_ID, new BigDecimal("2.500000"), 4).orElseThrow();
    long jobId = insertJob(projectId, "failed-release");
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("RELEASED", reservationStatus(jobId));
    assertEquals(0, activeReservations());
    assertEquals(0, BigDecimal.ZERO.compareTo(creditsUsed()));

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("RELEASED", reservationStatus(jobId));
    assertEquals(0, activeReservations());
    assertEquals(0, BigDecimal.ZERO.compareTo(creditsUsed()));
    assertFalse(quotaReservation.releaseForJob(jobId));
  }

  private void seedEntitlement() {
    jdbcTemplate.update(
        """
        INSERT INTO auth_users (id, email, display_name, enabled)
        VALUES (?, 'quota-lifecycle@example.test', 'Quota lifecycle test', TRUE)
        ON CONFLICT (id) DO NOTHING
        """,
        USER_ID);
    jdbcTemplate.update(
        """
        INSERT INTO plan_entitlements
          (plan_key, version, watermark_required, max_video_quality,
           max_longform_exports_month, max_short_exports_month,
           max_concurrent_expensive_jobs, feature_flags_json, monthly_credits, active_from)
        VALUES (?, 1, FALSE, 'STANDARD', 100, 100, 4,
                '{"storyAnalysis":true}'::jsonb, 100.000000,
                CURRENT_TIMESTAMP - INTERVAL '1 day')
        ON CONFLICT (plan_key, version) DO NOTHING
        """,
        PLAN_KEY);
    jdbcTemplate.update(
        """
        INSERT INTO user_plan_assignments
          (user_id, plan_key, entitlement_version, status, period_start, period_end)
        VALUES (?, ?, 1, 'ACTIVE',
                CURRENT_TIMESTAMP - INTERVAL '1 day',
                CURRENT_TIMESTAMP + INTERVAL '1 month')
        ON CONFLICT (user_id) DO UPDATE
           SET plan_key = EXCLUDED.plan_key,
               entitlement_version = EXCLUDED.entitlement_version,
               status = EXCLUDED.status,
               period_start = EXCLUDED.period_start,
               period_end = EXCLUDED.period_end
        """,
        USER_ID,
        PLAN_KEY);
  }

  private long insertProject() {
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO projects
          (name, owner_id, status, source_language, narration_language, metadata_language,
           image_aspect_ratio, image_quality_tier)
        VALUES ('Quota lifecycle project', ?, 'DRAFT', 'vi-VN', 'vi-VN', 'vi-VN',
                'RATIO_16_9', 'STANDARD')
        RETURNING id
        """,
        Long.class,
        USER_ID);
  }

  private long insertJob(long projectId, String suffix) {
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO generation_jobs
          (job_id, project_id, job_type, status, resource_class, progress,
           requested_by_user_id, billed_to_user_id)
        VALUES (?, ?, 'CHAPTER_ANALYZE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0, ?, ?)
        RETURNING id
        """,
        Long.class,
        "quota-lifecycle-" + suffix,
        projectId,
        USER_ID,
        USER_ID);
  }

  private String reservationStatus(long jobId) {
    return jdbcTemplate.queryForObject(
        "SELECT status FROM quota_reservations WHERE generation_job_id = ?",
        String.class,
        jobId);
  }

  private int activeReservations() {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT count(*) FROM quota_reservations WHERE user_id = ? AND status = 'RESERVED'",
            Integer.class,
            USER_ID);
    return count == null ? 0 : count;
  }

  private BigDecimal creditsUsed() {
    BigDecimal value =
        jdbcTemplate.queryForObject(
            "SELECT credits_used FROM usage_windows WHERE user_id = ?",
            BigDecimal.class,
            USER_ID);
    return value == null ? BigDecimal.ZERO : value;
  }
}
