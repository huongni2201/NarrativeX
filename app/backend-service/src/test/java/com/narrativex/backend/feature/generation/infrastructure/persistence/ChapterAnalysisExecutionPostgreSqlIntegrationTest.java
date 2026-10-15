package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisProviderCredential;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisRuntimeConfiguration;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionAttempt;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionProfile;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionSnapshot;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisExecutionStore;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisAttemptCheckpoint;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.json.JsonMapper;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ChapterAnalysisExecutionPostgreSqlIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("analysis_execution_test")
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

  @Autowired private JdbcTemplate jdbc;
  @Autowired private ChapterAnalysisExecutionStore store;

  @Test
  void migrationAddsDurableExecutionTablesAndNullableTelemetryWithoutSecrets() throws SQLException {
    try (Connection connection =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Statement statement = connection.createStatement()) {
      assertEquals(
          "7",
          scalar(
              statement,
              "SELECT max(version::integer)::text FROM flyway_schema_history WHERE success"));
      for (String table :
          new String[] {
            "analysis_runtime_configuration",
            "analysis_provider_credentials",
            "chapter_analysis_execution_snapshots",
            "chapter_analysis_execution_attempts"
          }) {
        assertTrue(exists(statement, "SELECT to_regclass('public." + table + "') IS NOT NULL"));
      }
      for (String column :
          new String[] {
            "prompt_tokens",
            "output_tokens",
            "thinking_tokens",
            "cached_tokens",
            "total_tokens",
            "runtime_ms"
          }) {
        assertTrue(
            exists(
                statement,
                "SELECT is_nullable = 'YES' FROM information_schema.columns "
                    + "WHERE table_schema='public' AND table_name='chapter_analysis_runs' "
                    + "AND column_name='"
                    + column
                    + "'"));
      }
      assertEquals(
          "'LEGACY_UNSPECIFIED'::character varying",
          scalar(
              statement,
              "SELECT column_default FROM information_schema.columns "
                  + "WHERE table_schema='public' AND table_name='chapter_analysis_runs' "
                  + "AND column_name='usage_state'"));
      assertFalse(
          exists(
              statement,
              "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
                  + "WHERE table_schema='public' AND table_name='analysis_provider_credentials' "
                  + "AND column_name IN ('access_token','refresh_token','profile_path','provider_auth_json'))"));
      assertTrue(
          exists(
              statement,
              "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' "
                  + "AND indexname='uq_chapter_analysis_attempt_active_job')"));
    }
  }

  @Test
  void runtimeCredentialSnapshotAndAttemptRoundTripWithCasAndReplay() {
    AnalysisRuntimeConfiguration current = store.findRuntimeConfiguration();
    assertEquals(
        "ANTIGRAVITY_CLI",
        jdbc.queryForObject(
            "SELECT execution_mode FROM analysis_runtime_configuration WHERE singleton_id = TRUE",
            String.class));
    assertEquals(ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI, current.executionMode());
    AnalysisRuntimeConfiguration desired =
        new AnalysisRuntimeConfiguration(
            current.revision(),
            current.executionMode(),
            current.model(),
            current.effort(),
            current.maxConcurrentAnalyses(),
            current.maxQueuedAnalyses(),
            current.maxInputBytes(),
            current.maxOutputBytes(),
            current.maxRuntimeMs(),
            current.rowVersion());
    AnalysisRuntimeConfiguration updated =
        store.updateRuntimeConfiguration(desired, current.rowVersion()).orElseThrow();
    assertEquals(current.revision() + 1, updated.revision());
    assertTrue(store.updateRuntimeConfiguration(desired, current.rowVersion()).isEmpty());

    UUID projectId = UuidV7.random();
    jdbc.update(
        "INSERT INTO projects (id, name, status, source_language, narration_language, image_aspect_ratio) "
            + "VALUES (?, ?, 'DRAFT', 'vi', 'vi', '16:9')",
        projectId,
        "Analysis execution integration");
    UUID deviceId = UuidV7.random();
    jdbc.update(
        "INSERT INTO local_devices (id, name, platform, agent_version, token_hash, last_seen_at) "
            + "VALUES (?, 'test device', 'windows', '1.0.0', ?, CURRENT_TIMESTAMP)",
        deviceId,
        "d".repeat(64));

    AnalysisProviderCredential credential =
        new AnalysisProviderCredential(
            UuidV7.random(),
            deviceId,
            "d".repeat(64),
            1,
            "agy session",
            "UNKNOWN",
            null,
            java.util.List.of(),
            "UNKNOWN",
            null,
            null,
            null,
            0,
            0);
    AnalysisProviderCredential savedCredential = store.insertCredential(credential);
    assertEquals(credential.credentialRef(), savedCredential.credentialRef());
    assertEquals(
        deviceId, store.findCredential(credential.credentialRef()).orElseThrow().deviceId());

    UUID publicJobId = UuidV7.random();
    UUID generationJobId =
        jdbc.queryForObject(
            "INSERT INTO generation_jobs (job_id, project_id, job_type, status, resource_class, progress, "
                + "idempotency_key, analysis_visual_generation_mode, analysis_image_provider) "
                + "VALUES (?, ?, 'CHAPTER_ANALYZE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0, ?, 'IMAGE', 'API') "
                + "RETURNING id",
            (result, row) -> result.getObject(1, UUID.class),
            publicJobId,
            projectId,
            "analysis-test:" + publicJobId);

    String promptHash = "a".repeat(64);
    String schemaHash = "b".repeat(64);
    String fingerprint = "c".repeat(64);
    var schema = JsonMapper.builder().build().createObjectNode();
    schema.put("type", "object");
    var profile =
        new ChapterAnalysisExecutionProfile(
            ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI,
            "verified-model",
            "HIGH",
            "1.1",
            promptHash,
            "1.1",
            schemaHash);
    ChapterAnalysisExecutionSnapshot snapshot =
        new ChapterAnalysisExecutionSnapshot(
            generationJobId,
            profile,
            "Analyze: {sourceText}",
            schema,
            fingerprint,
            updated.revision(),
            Instant.now());
    ChapterAnalysisExecutionSnapshot savedSnapshot = store.saveSnapshot(snapshot);
    ChapterAnalysisExecutionSnapshot loadedSnapshot =
        store.findSnapshot(generationJobId).orElseThrow();
    assertEquals(snapshot.profile(), savedSnapshot.profile());
    assertEquals(snapshot.promptTemplate(), loadedSnapshot.promptTemplate());
    assertEquals(snapshot.responseSchema(), loadedSnapshot.responseSchema());
    assertEquals(snapshot.inputFingerprint(), loadedSnapshot.inputFingerprint());
    assertEquals(snapshot.configRevision(), loadedSnapshot.configRevision());

    UUID attemptId = UuidV7.random();
    UUID claimRequestId = UuidV7.random();
    ChapterAnalysisExecutionAttempt attempt =
        new ChapterAnalysisExecutionAttempt(
            attemptId,
            generationJobId,
            1,
            claimRequestId,
            deviceId,
            credential.credentialRef(),
            1,
            fingerprint,
            ChapterAnalysisAttemptCheckpoint.CLAIMED,
            "e".repeat(64),
            Instant.now().plusSeconds(90),
            1,
            0,
            null,
            null,
            null,
            null,
            null,
            true,
            0,
            null,
            null);
    assertEquals(attemptId, store.insertAttempt(attempt).attemptId());

    ChapterAnalysisExecutionAttempt replay =
        new ChapterAnalysisExecutionAttempt(
            UuidV7.random(),
            generationJobId,
            1,
            claimRequestId,
            deviceId,
            credential.credentialRef(),
            1,
            fingerprint,
            ChapterAnalysisAttemptCheckpoint.CLAIMED,
            "e".repeat(64),
            attempt.leaseExpiresAt(),
            1,
            0,
            null,
            null,
            null,
            null,
            null,
            true,
            0,
            null,
            null);
    assertEquals(attemptId, store.insertAttempt(replay).attemptId());

    ChapterAnalysisExecutionAttempt submitting =
        new ChapterAnalysisExecutionAttempt(
            attemptId,
            generationJobId,
            1,
            claimRequestId,
            deviceId,
            credential.credentialRef(),
            1,
            fingerprint,
            ChapterAnalysisAttemptCheckpoint.SUBMITTING,
            attempt.leaseTokenHash(),
            attempt.leaseExpiresAt(),
            1,
            1,
            UuidV7.random(),
            null,
            null,
            null,
            null,
            true,
            0,
            null,
            null);
    assertTrue(store.updateAttempt(submitting, 0, 1));
    assertEquals(1, store.findActiveAttempt(generationJobId).orElseThrow().rowVersion());
    assertFalse(store.updateAttempt(submitting, 0, 1));

    assertNotEquals(publicJobId, generationJobId);
  }

  private static String scalar(Statement statement, String sql) throws SQLException {
    try (ResultSet result = statement.executeQuery(sql)) {
      assertTrue(result.next());
      return result.getString(1);
    }
  }

  private static boolean exists(Statement statement, String sql) throws SQLException {
    try (ResultSet result = statement.executeQuery(sql)) {
      assertTrue(result.next());
      return result.getBoolean(1);
    }
  }
}
