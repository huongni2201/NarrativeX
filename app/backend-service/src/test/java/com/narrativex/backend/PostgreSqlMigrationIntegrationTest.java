package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PostgreSqlMigrationIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("narrativex_test")
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

  @Autowired private DataSource dataSource;

  @Test
  void emptyPostgresMigratesAndApplicationContextStarts() throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      assertEquals(12, latestFlywayVersion(connection));
      assertEquals("jsonb", columnType(connection, "moderation_decisions", "categories_json"));
      assertTrue(indexExists(connection, "uq_story_versions_one_active_per_project"));
      assertTrue(indexExists(connection, "idx_projects_active_owner_updated_id"));
      assertTrue(columnExists(connection, "chapters", "source_hash"));
      assertEquals("NO", columnNullable(connection, "chapters", "source_text"));
      assertEquals("NO", columnNullable(connection, "chapters", "source_hash"));
      assertTrue(columnExists(connection, "projects", "description"));
      assertTrue(columnExists(connection, "projects", "cover_image_url"));
      assertTrue(columnExists(connection, "visual_beats", "title"));
      assertEquals("NO", columnNullable(connection, "visual_beats", "title"));
      assertTrue(columnExists(connection, "visual_beats", "review_status"));
      assertEquals("NO", columnNullable(connection, "visual_beats", "review_status"));
      assertTrue(columnExists(connection, "visual_beats", "motion_mode"));
      assertEquals("NO", columnNullable(connection, "visual_beats", "motion_mode"));
      assertTrue(columnExists(connection, "visual_beats", "camera_movement"));
      assertEquals("NO", columnNullable(connection, "visual_beats", "camera_movement"));
      assertFalse(columnExists(connection, "visual_beats", "motion_action"));
      assertTrue(indexExists(connection, "idx_visual_beats_scene_review_order"));
      assertTrue(indexExists(connection, "idx_generation_jobs_project_status"));
      assertTrue(indexExists(connection, "idx_stage_attempts_running_heartbeat"));
      assertTrue(indexExists(connection, "idx_scenes_chapter_status"));
      assertTrue(columnExists(connection, "scenes", "project_location_id"));
      assertTrue(tableExists(connection, "scene_characters"));
      assertTrue(indexExists(connection, "idx_scene_characters_project_character"));
      assertTrue(tableExists(connection, "project_locations"));
      assertTrue(tableExists(connection, "project_assets"));
      assertTrue(indexExists(connection, "idx_project_locations_active_project"));
      assertTrue(indexExists(connection, "idx_project_assets_active_project"));
      assertTrue(tableExists(connection, "project_character_ai_identities"));
      assertTrue(tableExists(connection, "project_location_ai_identities"));
      assertTrue(indexExists(connection, "idx_project_character_ai_identity_entity"));
      assertTrue(indexExists(connection, "idx_project_location_ai_identity_entity"));
      assertFalse(indexExists(connection, "idx_auth_users_email"));
      assertFalse(indexExists(connection, "idx_auth_users_google_subject"));
      assertFalse(columnExists(connection, "story_versions", "rights_attested"));
      assertFalse(columnExists(connection, "story_versions", "rights_policy_version"));
      assertFalse(columnExists(connection, "story_versions", "rights_basis"));
      assertFalse(columnExists(connection, "story_versions", "rights_attested_at"));
      assertFalse(columnExists(connection, "story_versions", "rights_attested_by"));
      assertFalse(tableExists(connection, "content_rights_attestations"));
      assertTrue(columnExists(connection, "operation_plans", "generation_job_id"));
      assertTrue(columnExists(connection, "provider_operations", "request_fingerprint"));
      assertTrue(columnExists(connection, "provider_operations", "result_fingerprint"));
      assertTrue(indexExists(connection, "uq_provider_operation_fingerprint"));
      assertTrue(indexExists(connection, "idx_provider_operations_result_fingerprint"));
      assertTrue(columnExists(connection, "plan_entitlements", "monthly_credits"));
      assertTrue(tableExists(connection, "quota_reservations"));
      assertTrue(indexExists(connection, "idx_quota_reservations_active_user"));
      assertTrue(tableExists(connection, "narration_requests"));
      assertTrue(tableExists(connection, "narration_operations"));
      assertTrue(tableExists(connection, "narration_assets"));
      assertTrue(tableExists(connection, "narration_alignments"));
      assertTrue(tableExists(connection, "media_assets"));
      assertTrue(tableExists(connection, "narration_sets"));
      assertTrue(tableExists(connection, "narration_parts"));
      assertTrue(tableExists(connection, "narration_documents"));
      assertTrue(tableExists(connection, "narration_document_chapters"));
      assertTrue(tableExists(connection, "narration_alignment_runs"));
      assertTrue(constraintExists(connection, "generation_jobs", "ck_generation_jobs_progress"));
      assertTrue(constraintExists(connection, "generation_jobs", "ck_generation_jobs_status"));
      assertTrue(constraintExists(connection, "generation_jobs", "ck_generation_jobs_job_type"));
      assertTrue(
          constraintExists(connection, "generation_jobs", "ck_generation_jobs_resource_class"));
      assertTrue(constraintExists(connection, "stage_attempts", "ck_stage_attempts_status"));
      assertTrue(
          constraintExists(connection, "provider_operations", "ck_provider_operations_status"));
      assertTrue(
          constraintExists(connection, "quota_reservations", "ck_quota_reservations_status"));
    }
  }

  @Test
  void postgresEnforcesCanonicalExecutionContract() throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      long projectId = insertProject(connection);

      SQLException negativeProgress =
          assertThrows(
              SQLException.class,
              () ->
                  insertGenerationJob(
                      connection,
                      projectId,
                      "negative-progress",
                      "CHAPTER_ANALYZE",
                      "QUEUED",
                      "PROVIDER_INTERACTIVE",
                      -1));
      assertEquals("23514", negativeProgress.getSQLState());

      SQLException excessiveProgress =
          assertThrows(
              SQLException.class,
              () ->
                  insertGenerationJob(
                      connection,
                      projectId,
                      "excessive-progress",
                      "CHAPTER_ANALYZE",
                      "QUEUED",
                      "PROVIDER_INTERACTIVE",
                      101));
      assertEquals("23514", excessiveProgress.getSQLState());

      SQLException invalidJobStatus =
          assertThrows(
              SQLException.class,
              () ->
                  insertGenerationJob(
                      connection,
                      projectId,
                      "invalid-job-status",
                      "CHAPTER_ANALYZE",
                      "SUCCEEDED",
                      "PROVIDER_INTERACTIVE",
                      0));
      assertEquals("23514", invalidJobStatus.getSQLState());

      SQLException invalidJobType =
          assertThrows(
              SQLException.class,
              () ->
                  insertGenerationJob(
                      connection,
                      projectId,
                      "invalid-job-type",
                      "UNKNOWN_JOB",
                      "QUEUED",
                      "PROVIDER_INTERACTIVE",
                      0));
      assertEquals("23514", invalidJobType.getSQLState());

      SQLException invalidResourceClass =
          assertThrows(
              SQLException.class,
              () ->
                  insertGenerationJob(
                      connection,
                      projectId,
                      "invalid-resource",
                      "CHAPTER_ANALYZE",
                      "QUEUED",
                      "UNKNOWN_RESOURCE",
                      0));
      assertEquals("23514", invalidResourceClass.getSQLState());

      long jobId =
          insertGenerationJob(
              connection,
              projectId,
              "valid-execution",
              "CHAPTER_ANALYZE",
              "QUEUED",
              "PROVIDER_INTERACTIVE",
              0);
      long stageAttemptId = insertStageAttempt(connection, jobId, "valid-stage", "QUEUED");

      SQLException invalidStageStatus =
          assertThrows(
              SQLException.class,
              () -> insertStageAttempt(connection, jobId, "invalid-stage", "SUCCEEDED"));
      assertEquals("23514", invalidStageStatus.getSQLState());

      SQLException invalidProviderStatus =
          assertThrows(
              SQLException.class,
              () -> insertProviderOperation(connection, stageAttemptId, "DONE"));
      assertEquals("23514", invalidProviderStatus.getSQLState());

      updateJobStatus(connection, jobId, "RUNNING", 5);
      updateJobStatus(connection, jobId, "UNKNOWN", 5);
      updateJobStatus(connection, jobId, "STALLED", 5);
      updateJobStatus(connection, jobId, "PAUSED_COST_LIMIT", 5);
      updateJobStatus(connection, jobId, "FAILED", 100);
      updateStageStatus(connection, stageAttemptId, "RUNNING");
      updateStageStatus(connection, stageAttemptId, "UNKNOWN");
      updateStageStatus(connection, stageAttemptId, "STALLED");
      updateStageStatus(connection, stageAttemptId, "PAUSED_COST_LIMIT");
      updateStageStatus(connection, stageAttemptId, "FAILED");

      long providerOperationId = insertProviderOperation(connection, stageAttemptId, "RESERVED");
      updateProviderStatus(connection, providerOperationId, "SUBMITTED");
      updateProviderStatus(connection, providerOperationId, "RUNNING");
      updateProviderStatus(connection, providerOperationId, "UNKNOWN");
      updateProviderStatus(connection, providerOperationId, "FAILED");
    }
  }

  @Test
  void visualBeatMotionMigrationPreservesLegacySemanticsAndRejectsInvalidValues()
      throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      assertEquals("BASIC_MOTION/PAN", visualBeatMotion(connection, 5001L));
      assertEquals("BASIC_MOTION/TILT", visualBeatMotion(connection, 5005L));
      assertEquals("STILL/NONE", visualBeatMotion(connection, 5004L));
      assertEquals("BASIC_MOTION/PARALLAX", visualBeatMotion(connection, 5006L));

      connection.setAutoCommit(false);
      SQLException invalidMotionMode =
          assertThrows(
              SQLException.class,
              () -> insertVisualBeatWithMotion(connection, 99, "INVALID_MODE", "NONE"));
      assertEquals("23514", invalidMotionMode.getSQLState());
      connection.rollback();

      SQLException invalidCameraMovement =
          assertThrows(
              SQLException.class,
              () -> insertVisualBeatWithMotion(connection, 99, "STILL", "INVALID_CAMERA"));
      assertEquals("23514", invalidCameraMovement.getSQLState());
      connection.rollback();
    }
  }

  @Test
  void postgresEnforcesForeignKeyAndOneActiveStoryVersionPerProject() throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      long projectId = insertProject(connection);
      insertStoryVersion(connection, projectId, 1, "ACTIVE");
      connection.commit();

      SQLException duplicateActive =
          assertThrows(
              SQLException.class, () -> insertStoryVersion(connection, projectId, 2, "ACTIVE"));
      assertEquals("23505", duplicateActive.getSQLState());
      connection.rollback();

      SQLException missingProject =
          assertThrows(
              SQLException.class, () -> insertStoryVersion(connection, Long.MAX_VALUE, 3, "DRAFT"));
      assertEquals("23503", missingProject.getSQLState());
      connection.rollback();
    }
  }

  @Test
  void postgresForUpdateLockSerializesProjectMutation() throws SQLException {
    long projectId;
    try (Connection seed = dataSource.getConnection()) {
      projectId = insertProject(seed);
    }

    try (Connection holder = dataSource.getConnection();
        Connection contender = dataSource.getConnection()) {
      holder.setAutoCommit(false);
      contender.setAutoCommit(false);
      lockProject(holder, projectId);
      try (Statement timeout = contender.createStatement()) {
        timeout.execute("set local lock_timeout = '200ms'");
      }

      SQLException lockTimeout =
          assertThrows(SQLException.class, () -> lockProject(contender, projectId));
      assertEquals("55P03", lockTimeout.getSQLState());
      contender.rollback();
      holder.rollback();
    }
  }

  private static int latestFlywayVersion(Connection connection) throws SQLException {
    try (PreparedStatement statement =
            connection.prepareStatement(
                "select max(cast(version as integer)) from flyway_schema_history where success ="
                    + " true");
        ResultSet result = statement.executeQuery()) {
      result.next();
      return result.getInt(1);
    }
  }

  private static String columnType(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select data_type from information_schema.columns "
                + "where table_schema = 'public' and table_name = ? and column_name = ?")) {
      statement.setString(1, table);
      statement.setString(2, column);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getString(1);
      }
    }
  }

  private static String columnNullable(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select is_nullable from information_schema.columns "
                + "where table_schema = 'public' and table_name = ? and column_name = ?")) {
      statement.setString(1, table);
      statement.setString(2, column);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getString(1);
      }
    }
  }

  private static boolean columnExists(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select exists(select 1 from information_schema.columns "
                + "where table_schema = 'public' and table_name = ? and column_name = ?)")) {
      statement.setString(1, table);
      statement.setString(2, column);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getBoolean(1);
      }
    }
  }

  private static boolean tableExists(Connection connection, String table) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select exists(select 1 from information_schema.tables "
                + "where table_schema = 'public' and table_name = ?)")) {
      statement.setString(1, table);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getBoolean(1);
      }
    }
  }

  private static boolean indexExists(Connection connection, String indexName) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select exists(select 1 from pg_indexes where schemaname = 'public' and indexname ="
                + " ?)")) {
      statement.setString(1, indexName);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getBoolean(1);
      }
    }
  }

  private static boolean constraintExists(Connection connection, String table, String constraint)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select exists(select 1 from pg_constraint c "
                + "join pg_class t on t.oid = c.conrelid "
                + "join pg_namespace n on n.oid = t.relnamespace "
                + "where n.nspname = 'public' and t.relname = ? and c.conname = ?)")) {
      statement.setString(1, table);
      statement.setString(2, constraint);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getBoolean(1);
      }
    }
  }

  private static String visualBeatMotion(Connection connection, long visualBeatId)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select motion_mode, camera_movement from visual_beats where id = ?")) {
      statement.setLong(1, visualBeatId);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next());
        return result.getString(1) + "/" + result.getString(2);
      }
    }
  }

  private static void insertVisualBeatWithMotion(
      Connection connection, int orderIndex, String motionMode, String cameraMovement)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "insert into visual_beats (scene_id, order_index, title, visual_intent, review_status,"
                + " motion_mode, camera_movement) values (4001, ?, 'Migration test', 'Migration"
                + " test intent', 'NEEDS_REVIEW', ?, ?)")) {
      statement.setInt(1, orderIndex);
      statement.setString(2, motionMode);
      statement.setString(3, cameraMovement);
      statement.executeUpdate();
    }
  }

  private static long insertProject(Connection connection) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "insert into projects (name, owner_id, status, source_language, narration_language,"
                + " metadata_language, image_aspect_ratio, image_quality_tier) values ('Project',"
                + " 'owner', 'DRAFT', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD')"
                + " returning id")) {
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getLong(1);
      }
    }
  }

  private static void insertStoryVersion(
      Connection connection, long projectId, int versionNumber, String status) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "insert into story_versions (project_id, version_number, content, source_language,"
                + " status, moderation_decision) values (?, ?, 'story', 'vi-VN', ?, 'PENDING')")) {
      statement.setLong(1, projectId);
      statement.setInt(2, versionNumber);
      statement.setString(3, status);
      statement.executeUpdate();
    }
  }

  private static long insertGenerationJob(
      Connection connection,
      long projectId,
      String suffix,
      String jobType,
      String status,
      String resourceClass,
      int progress)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "insert into generation_jobs "
                + "(job_id, project_id, job_type, status, resource_class, progress, "
                + "requested_by_user_id, billed_to_user_id) "
                + "values (?, ?, ?, ?, ?, ?, 'migration-test-user', 'migration-test-user') "
                + "returning id")) {
      statement.setString(1, "migration-test-" + suffix);
      statement.setLong(2, projectId);
      statement.setString(3, jobType);
      statement.setString(4, status);
      statement.setString(5, resourceClass);
      statement.setInt(6, progress);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getLong(1);
      }
    }
  }

  private static long insertStageAttempt(
      Connection connection, long generationJobId, String stageName, String status)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "insert into stage_attempts "
                + "(generation_job_id, stage_name, attempt_number, status) "
                + "values (?, ?, 1, ?) returning id")) {
      statement.setLong(1, generationJobId);
      statement.setString(2, stageName);
      statement.setString(3, status);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getLong(1);
      }
    }
  }

  private static long insertProviderOperation(
      Connection connection, long stageAttemptId, String status) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "insert into provider_operations "
                + "(stage_attempt_id, provider_key, provider_operation_id, status) "
                + "values (?, 'migration-test-provider', ?, ?) returning id")) {
      statement.setLong(1, stageAttemptId);
      statement.setString(2, "migration-test-operation-" + status);
      statement.setString(3, status);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getLong(1);
      }
    }
  }

  private static void updateJobStatus(
      Connection connection, long jobId, String status, int progress) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "update generation_jobs set status = ?, progress = ? where id = ?")) {
      statement.setString(1, status);
      statement.setInt(2, progress);
      statement.setLong(3, jobId);
      assertEquals(1, statement.executeUpdate());
    }
  }

  private static void updateStageStatus(Connection connection, long stageId, String status)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement("update stage_attempts set status = ? where id = ?")) {
      statement.setString(1, status);
      statement.setLong(2, stageId);
      assertEquals(1, statement.executeUpdate());
    }
  }

  private static void updateProviderStatus(Connection connection, long operationId, String status)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement("update provider_operations set status = ? where id = ?")) {
      statement.setString(1, status);
      statement.setLong(2, operationId);
      assertEquals(1, statement.executeUpdate());
    }
  }

  private static void lockProject(Connection connection, long projectId) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement("select id from projects where id = ? for update")) {
      statement.setLong(1, projectId);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next());
      }
    }
  }
}
