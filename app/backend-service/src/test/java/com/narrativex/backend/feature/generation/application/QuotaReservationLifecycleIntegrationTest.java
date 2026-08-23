package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import java.math.BigDecimal;
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
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.data.redis.repositories.enabled", () -> false);
  }

  @Autowired private QuotaReservation quotaReservation;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void completedJobConsumesActualCostAndImmediatelyFreesConcurrentCapacity() {
    seedEntitlement();
    UUID projectId = insertProject();
    List<UUID> jobIds = new ArrayList<>();

    for (int index = 0; index < 4; index++) {
      var reservation =
          quotaReservation.reserve(USER_ID, new BigDecimal("1.000000"), 4).orElseThrow();
      UUID jobId = insertJob(projectId, "complete-slot-" + index);
      quotaReservation.bindToGenerationJob(reservation.id(), jobId);
      jobIds.add(jobId);
    }

    assertTrue(
        quotaReservation.reserve(USER_ID, new BigDecimal("1.000000"), 4).isEmpty(),
        "The fifth active expensive job must be rejected while four reservations are RESERVED");

    persistProviderBilling(jobIds.getFirst(), new BigDecimal("0.123456789"));
    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?",
        jobIds.getFirst());

    assertEquals("CONSUMED", reservationStatus(jobIds.getFirst()));
    assertEquals(
        0, new BigDecimal("0.123456789").compareTo(reservationActualCost(jobIds.getFirst())));
    assertEquals(3, activeReservations());
    assertEquals(0, new BigDecimal("0.123456789").compareTo(creditsUsed()));

    assertTrue(
        quotaReservation.reserve(USER_ID, new BigDecimal("1.000000"), 4).isPresent(),
        "A completed job must free its concurrent slot");
  }

  @Test
  void completedLocalVieNeuNarrationConsumesZeroCostWithoutProviderOperation() {
    seedEntitlement();
    UUID projectId = insertProject();
    var reservation = quotaReservation.reserve(USER_ID, BigDecimal.ZERO, 4).orElseThrow();
    UUID jobId = insertLocalVieNeuNarrationJob(projectId);
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);

    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?", jobId);

    assertEquals("CONSUMED", reservationStatus(jobId));
    assertEquals(0, BigDecimal.ZERO.compareTo(reservationActualCost(jobId)));
    assertEquals("USD", reservationCurrency(jobId));
    assertEquals(0, activeReservations());
    assertEquals(0, BigDecimal.ZERO.compareTo(creditsUsed()));
  }

  @Test
  void failedJobReleasesReservationWithoutChargingCreditsAndRetryIsIdempotent() {
    seedEntitlement();
    UUID projectId = insertProject();
    var reservation =
        quotaReservation.reserve(USER_ID, new BigDecimal("2.500000"), 4).orElseThrow();
    UUID jobId = insertJob(projectId, "failed-release");
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("RELEASED", reservationStatus(jobId));
    assertEquals(0, BigDecimal.ZERO.compareTo(reservationActualCost(jobId)));
    assertEquals(0, activeReservations());
    assertEquals(0, BigDecimal.ZERO.compareTo(creditsUsed()));

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("RELEASED", reservationStatus(jobId));
    assertEquals(0, activeReservations());
    assertEquals(0, BigDecimal.ZERO.compareTo(creditsUsed()));
    assertFalse(quotaReservation.releaseForJob(jobId));
  }

  @Test
  void failedBillableProviderOperationConsumesActualCostExactlyOnce() {
    seedEntitlement();
    UUID projectId = insertProject();
    var reservation =
        quotaReservation.reserve(USER_ID, new BigDecimal("2.500000"), 4).orElseThrow();
    UUID jobId = insertJob(projectId, "failed-billable");
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);
    persistProviderBilling(jobId, new BigDecimal("0.031250000"));

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("CONSUMED", reservationStatus(jobId));
    assertEquals(0, new BigDecimal("0.031250000").compareTo(reservationActualCost(jobId)));
    assertEquals(0, new BigDecimal("0.031250000").compareTo(creditsUsed()));

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals(0, new BigDecimal("0.031250000").compareTo(creditsUsed()));
    assertFalse(quotaReservation.consumeForJob(jobId));
  }

  @Test
  void zeroCostProviderFailureReleasesReservation() {
    seedEntitlement();
    UUID projectId = insertProject();
    var reservation =
        quotaReservation.reserve(USER_ID, new BigDecimal("1.000000"), 4).orElseThrow();
    UUID jobId = insertJob(projectId, "failed-zero-cost");
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);
    persistProviderBilling(jobId, BigDecimal.ZERO.setScale(9));

    jdbcTemplate.update("UPDATE generation_jobs SET status = 'FAILED' WHERE id = ?", jobId);

    assertEquals("RELEASED", reservationStatus(jobId));
    assertEquals(0, BigDecimal.ZERO.compareTo(creditsUsed()));
  }

  @Test
  void ultraPayAsYouGoAllowsUncappedReservationsAndConsumesActualCost() {
    seedUltraEntitlement();
    UUID projectId = insertProject();
    var reservation =
        quotaReservation.reserve(USER_ID, new BigDecimal("500.000000"), 20).orElseThrow();
    UUID jobId = insertJob(projectId, "ultra-job-1");
    quotaReservation.bindToGenerationJob(reservation.id(), jobId);
    persistProviderBilling(jobId, new BigDecimal("45.500000000"));

    jdbcTemplate.update(
        "UPDATE generation_jobs SET status = 'COMPLETED', progress = 100 WHERE id = ?", jobId);

    assertEquals("CONSUMED", reservationStatus(jobId));
    assertEquals(0, new BigDecimal("45.500000000").compareTo(reservationActualCost(jobId)));
    assertEquals(0, new BigDecimal("45.500000000").compareTo(creditsUsed()));
  }

  private void seedUltraEntitlement() {
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
        VALUES ('ULTRA', 1, FALSE, 'ULTRA', NULL, NULL, 20,
                '{"storyAnalysis":true,"shorts":true,"narration":true,"payAsYouGo":true}'::jsonb, NULL,
                CURRENT_TIMESTAMP - INTERVAL '1 day')
        ON CONFLICT (plan_key, version) DO NOTHING
        """);
    jdbcTemplate.update(
        """
        INSERT INTO user_plan_assignments
          (user_id, plan_key, entitlement_version, status, period_start, period_end)
        VALUES (?, 'ULTRA', 1, 'ACTIVE',
                CURRENT_TIMESTAMP - INTERVAL '1 day',
                CURRENT_TIMESTAMP + INTERVAL '1 month')
        ON CONFLICT (user_id) DO UPDATE
           SET plan_key = EXCLUDED.plan_key,
               entitlement_version = EXCLUDED.entitlement_version,
               status = EXCLUDED.status,
               period_start = EXCLUDED.period_start,
               period_end = EXCLUDED.period_end
        """,
        USER_ID);
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
           requested_by_user_id, billed_to_user_id)
        VALUES (?, ?, 'CHAPTER_ANALYZE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0, ?, ?)
        RETURNING id
        """,
        UUID.class,
        com.narrativex.backend.feature.common.uuid.UuidV7.random(),
        projectId,
        USER_ID,
        USER_ID);
  }

  private UUID insertLocalVieNeuNarrationJob(UUID projectId) {
    UUID storyVersionId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO story_versions
              (project_id, version_number, content, source_language, status, moderation_decision)
            VALUES (?, 1, 'Narration source', 'vi-VN', 'ACTIVE', 'SAFE')
            RETURNING id
            """,
            UUID.class,
            projectId);
    UUID chapterId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO chapters
              (story_version_id, order_index, title, source_text, source_hash, status)
            VALUES (?, 0, 'Chapter 1', 'Xin chao', ?, 'DRAFT')
            RETURNING id
            """,
            UUID.class,
            storyVersionId,
            "a".repeat(64));
    UUID jobId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO generation_jobs
              (job_id, project_id, job_type, status, resource_class, progress,
               requested_by_user_id, billed_to_user_id, story_version_id, chapter_id)
            VALUES (?, ?, 'NARRATION_GENERATE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0, ?, ?, ?, ?)
            RETURNING id
            """,
            UUID.class,
            com.narrativex.backend.feature.common.uuid.UuidV7.random(),
            projectId,
            USER_ID,
            USER_ID,
            storyVersionId,
            chapterId);
    UUID stageAttemptId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO stage_attempts (generation_job_id, stage_name, attempt_number, status)
            VALUES (?, 'NARRATION_TTS', 1, 'RUNNING')
            RETURNING id
            """,
            UUID.class,
            jobId);
    UUID narrationRequestId = com.narrativex.backend.feature.common.uuid.UuidV7.random();
    jdbcTemplate.update(
        """
        INSERT INTO narration_requests
          (id, project_id, chapter_id, chapter_row_version, source_hash, source_text,
           voice_id, language, speaking_rate, segmentation_version, request_fingerprint)
        VALUES (?, ?, ?, 0, ?, 'Xin chao', 'vieneu-ngoc-huyen-v2', 'vi-VN', 1.0,
                'sentence-v1', ?)
        """,
        narrationRequestId,
        projectId,
        chapterId,
        "a".repeat(64),
        "b".repeat(64));
    jdbcTemplate.update(
        """
        INSERT INTO narration_operations
          (id, narration_request_id, generation_job_id, stage_attempt_id)
        VALUES (?, ?, ?, ?)
        """,
        com.narrativex.backend.feature.common.uuid.UuidV7.random(),
        narrationRequestId,
        jobId,
        stageAttemptId);
    return jobId;
  }

  private void persistProviderBilling(UUID jobId, BigDecimal actualCost) {
    UUID stageAttemptId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO stage_attempts (generation_job_id, stage_name, attempt_number, status)
            VALUES (?, 'CHAPTER_ANALYSIS', 1, 'RUNNING')
            RETURNING id
            """,
            UUID.class,
            jobId);
    jdbcTemplate.update(
        """
        INSERT INTO provider_operations
          (stage_attempt_id, provider_key, provider_operation_id, status, request_fingerprint,
           actual_cost, billing_currency, usage_json, pricing_snapshot_json)
        VALUES (?, 'vertex', ?, 'FAILED', ?, ?, 'USD',
                '{"prompt_tokens":100}'::jsonb,
                '{"catalog_version":"test"}'::jsonb)
        """,
        stageAttemptId,
        "provider-op-" + jobId,
        "a".repeat(32) + com.narrativex.backend.feature.common.uuid.UuidV7.random().toString().replace("-", ""),
        actualCost);
  }

  private String reservationStatus(UUID jobId) {
    return jdbcTemplate.queryForObject(
        "SELECT status FROM quota_reservations WHERE generation_job_id = ?", String.class, jobId);
  }

  private BigDecimal reservationActualCost(UUID jobId) {
    BigDecimal value =
        jdbcTemplate.queryForObject(
            "SELECT actual_cost FROM quota_reservations WHERE generation_job_id = ?",
            BigDecimal.class,
            jobId);
    return value == null ? BigDecimal.ZERO : value;
  }

  private String reservationCurrency(UUID jobId) {
    return jdbcTemplate.queryForObject(
        "SELECT billing_currency FROM quota_reservations WHERE generation_job_id = ?",
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
            "SELECT credits_used FROM usage_windows WHERE user_id = ?", BigDecimal.class, USER_ID);
    return value == null ? BigDecimal.ZERO : value;
  }
}
