package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
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
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class QuotaReservationLifecycleIntegrationTest {
  private static final String USER_ID = "quota-lifecycle-test-user";
  private static final String PLAN_KEY = "QUOTA_LIFECYCLE_TEST";

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_quota_test")
          .withUsername("narrativex")
          .withPassword("narrativex");

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.session.jdbc.initialize-schema", () -> "never");
  }

  @Autowired private QuotaReservation quotaReservation;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void completedJobConsumesReservationAndImmediatelyFreesConcurrentCapacity() {
    seedEntitlement(4, 100);
    UUID projectId = insertProject();
    List<UUID> jobIds = new ArrayList<>();

    for (int index = 0; index < 4; index++) {
      var reservation = quotaReservation.reserve(USER_ID, 4).orElseThrow();
      UUID jobId = insertJob(projectId, "complete-slot-" + index);
      quotaReservation.bindToGenerationJob(reservation.id(), jobId);
      jobIds.add(jobId);
    }

    assertTrue(
        quotaReservation.reserve(USER_ID, 4).isEmpty(),
        "The fifth active expensive job must be rejected while four reservations are RESERVED");

    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?",
        jobIds.getFirst());

    assertEquals("CONSUMED", reservationStatus(jobIds.getFirst()));
    assertEquals(3, activeReservations());
    assertTrue(
        quotaReservation.reserve(USER_ID, 4).isPresent(),
        "A completed job must free its concurrent slot");
  }

  @Test
  void failedJobAlwaysReleasesReservationAndRetryIsIdempotent() {
    seedEntitlement(4, 100);
    UUID projectId = insertProject();
    var reservation = quotaReservation.reserve(USER_ID, 4).orElseThrow();
    UUID jobId = insertJob(projectId, "failed-release");
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("RELEASED", reservationStatus(jobId));
    assertEquals(0, activeReservations());

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("RELEASED", reservationStatus(jobId));
    assertEquals(0, activeReservations());
    assertFalse(quotaReservation.releaseForJob(jobId));
    assertFalse(quotaReservation.consumeForJob(jobId));
  }

  @Test
  void higherConcurrencyEntitlementAllowsCapacityWithoutMonetaryAdmission() {
    seedEntitlement(20, null);
    UUID projectId = insertProject();
    List<UUID> jobIds = new ArrayList<>();

    for (int index = 0; index < 20; index++) {
      var reservation = quotaReservation.reserve(USER_ID, 20).orElseThrow();
      UUID jobId = insertJob(projectId, "capacity-" + index);
      quotaReservation.bindToGenerationJob(reservation.id(), jobId);
      jobIds.add(jobId);
    }

    assertEquals(20, activeReservations());
    assertTrue(quotaReservation.reserve(USER_ID, 20).isEmpty());

    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?",
        jobIds.getFirst());
    assertTrue(quotaReservation.reserve(USER_ID, 20).isPresent());
  }

  @Test
  void longformExportReservesLastUnitAndConfirmedFailureReleasesIt() {
    seedEntitlement(4, 1);
    UUID projectId = insertProject();
    var reservation = quotaReservation.reserveLongformExport(USER_ID, 4, 1).orElseThrow();
    UUID jobId = insertProjectRenderJob(projectId);
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);

    assertTrue(quotaReservation.reserveLongformExport(USER_ID, 4, 1).isEmpty());

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertTrue(quotaReservation.reserveLongformExport(USER_ID, 4, 1).isPresent());
    assertEquals(0, longformExportsUsed());
  }

  @Test
  void completedLongformExportSettlesExactlyOnceIntoReservationPeriod() {
    seedEntitlement(4, 1);
    UUID projectId = insertProject();
    var reservation = quotaReservation.reserveLongformExport(USER_ID, 4, 1).orElseThrow();
    UUID jobId = insertProjectRenderJob(projectId);
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);

    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?", jobId);
    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?", jobId);

    assertEquals(1, longformExportsUsed());
    assertTrue(quotaReservation.reserveLongformExport(USER_ID, 4, 1).isEmpty());
  }

  private void seedEntitlement(int maxConcurrentJobs, Integer maxLongformExports) {
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
           max_concurrent_expensive_jobs, feature_flags_json, active_from)
        VALUES (?, 1, FALSE, 'STANDARD', ?, 100, ?,
                '{"storyAnalysis":true}'::jsonb,
                CURRENT_TIMESTAMP - INTERVAL '1 day')
        ON CONFLICT (plan_key, version) DO UPDATE
           SET max_longform_exports_month = EXCLUDED.max_longform_exports_month,
               max_concurrent_expensive_jobs = EXCLUDED.max_concurrent_expensive_jobs
        """,
        PLAN_KEY,
        maxLongformExports,
        maxConcurrentJobs);
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

  private int longformExportsUsed() {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT longform_exports FROM usage_windows WHERE user_id = ? AND period_key = to_char(CURRENT_DATE, 'YYYY-MM')",
            Integer.class,
            USER_ID);
    return count == null ? 0 : count;
  }

  private UUID insertProject() {
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO projects
          (name, owner_id, status, source_language, narration_language, metadata_language,
           image_aspect_ratio, image_quality_tier)
        VALUES ('Quota lifecycle project', ?, 'DRAFT', 'vi-VN', 'vi-VN', 'vi-VN',
                'RATIO_16_9', 'STANDARD')
        RETURNING id
        """,
        UUID.class,
        USER_ID);
  }

  private UUID insertJob(UUID projectId, String suffix) {
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO generation_jobs
          (job_id, project_id, job_type, status, resource_class, progress,
           requested_by_user_id, billed_to_user_id, idempotency_key)
        VALUES (?, ?, 'CHAPTER_ANALYZE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0, ?, ?, ?)
        RETURNING id
        """,
        UUID.class,
        com.narrativex.backend.feature.common.uuid.UuidV7.random(),
        projectId,
        USER_ID,
        USER_ID,
        suffix);
  }

  private UUID insertProjectRenderJob(UUID projectId) {
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO generation_jobs
          (job_id, project_id, job_type, status, resource_class, progress,
           requested_by_user_id, billed_to_user_id)
        VALUES (?, ?, 'RENDER_PROJECT', 'QUEUED', 'CPU_RENDER', 0, ?, ?)
        RETURNING id
        """,
        UUID.class,
        com.narrativex.backend.feature.common.uuid.UuidV7.random(),
        projectId,
        USER_ID,
        USER_ID);
  }

  private String reservationStatus(UUID jobId) {
    return jdbcTemplate.queryForObject(
        "SELECT status FROM quota_reservations WHERE generation_job_id = ?", String.class, jobId);
  }

  private int activeReservations() {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT count(*) FROM quota_reservations WHERE user_id = ? AND status = 'RESERVED'",
            Integer.class,
            USER_ID);
    return count == null ? 0 : count;
  }
}
