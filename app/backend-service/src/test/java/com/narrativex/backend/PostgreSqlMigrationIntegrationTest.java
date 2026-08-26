package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineMapper;
import com.narrativex.backend.feature.notification.infrastructure.persistence.mybatis.NotificationMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.LanguageDetectionMapper;
import com.narrativex.backend.support.FlywayMigrationContract;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
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

/** Contract test for the authoritative PostgreSQL/Flyway schema and MyBatis UUID mappings. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PostgreSqlMigrationIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_test")
          .withUsername("narrativex")
          .withPassword("narrativex");

  private static final List<String> UUID_ID_TABLES =
      List.of(
          "projects",
          "story_versions",
          "chapters",
          "chapter_creation_idempotency",
          "chapter_content_variants",
          "storyboard_revisions",
          "characters",
          "character_versions",
          "outfit_versions",
          "character_appearances",
          "project_characters",
          "project_locations",
          "project_assets",
          "scenes",
          "visual_beats",
          "generation_jobs",
          "stage_attempts",
          "provider_operations",
          "operation_plans",
          "render_manifests");

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

  @Autowired private DataSource dataSource;
  @Autowired private Flyway flyway;
  @Autowired private ProjectMapper projectMapper;
  @Autowired private ChapterWorkspaceMapper chapterWorkspaceMapper;
  @Autowired private LanguageDetectionMapper languageDetectionMapper;
  @Autowired private NotificationMapper notificationMapper;
  @Autowired private ProductionTimelineMapper productionTimelineMapper;

  @Test
  void emptyPostgresMigratesThroughAuthoritativeUuidSchema() throws SQLException, IOException {
    try (Connection connection = dataSource.getConnection()) {
      List<String> migrationNames = FlywayMigrationContract.discoverMigrationNames();
      assertEquals(FlywayMigrationContract.canonicalMigrationNames(), migrationNames);
      String latestMigration = migrationNames.get(migrationNames.size() - 1);
      assertEquals(
          Integer.toString(FlywayMigrationContract.version(latestMigration)),
          latestFlywayVersion(connection));
      assertEquals(migrationNames.size(), successfulVersionedMigrationCount(connection));
      assertEquals(0, flyway.info().pending().length, "startup must leave no pending migration");

      flyway.migrate();
      assertEquals(migrationNames.size(), successfulVersionedMigrationCount(connection));
      assertEquals(
          latestFlywayVersion(connection), flyway.info().current().getVersion().getVersion());
      assertEquals(0, flyway.info().pending().length, "repeat migrate must be a no-op");
      assertTrue(triggerExists(connection, "trg_generation_jobs_notify_completion"));
      assertTrue(triggerExists(connection, "trg_generation_jobs_sse_events"));
      assertEquals(512, characterMaximumLength(connection, "generation_jobs", "idempotency_key"));

      for (String table : UUID_ID_TABLES) {
        assertEquals("uuid", columnType(connection, table, "id"), table + ".id must be UUID");
        assertTrue(
            columnDefault(connection, table, "id").contains("narrativex_uuid_v7()"),
            table + ".id must use the UUIDv7 default");
      }

      assertEquals("uuid", columnType(connection, "generation_jobs", "job_id"));
      assertEquals("uuid", columnType(connection, "generation_jobs", "project_id"));
      assertEquals("uuid", columnType(connection, "generation_jobs", "chapter_id"));
      assertEquals("uuid", columnType(connection, "generation_jobs", "story_version_id"));
      assertEquals("uuid", columnType(connection, "generation_jobs", "storyboard_revision_id"));
      assertEquals("uuid", columnType(connection, "generation_jobs", "content_variant_id"));
      assertEquals("uuid", columnType(connection, "language_detections", "content_variant_id"));
      assertEquals("uuid", columnType(connection, "notifications", "project_id"));
      assertEquals("uuid", columnType(connection, "chapter_media_heads", "chapter_id"));
      assertEquals("uuid", columnType(connection, "chapter_media_heads", "generation_job_id"));
      assertEquals("uuid", columnType(connection, "render_input_snapshots", "generation_job_id"));
      assertEquals("uuid", columnType(connection, "narration_requests", "project_id"));
      assertEquals("uuid", columnType(connection, "narration_requests", "chapter_id"));
      assertEquals("uuid", columnType(connection, "media_generation_items", "generation_job_id"));
      assertEquals(
          "uuid", columnType(connection, "media_generation_items", "provider_operation_id"));
      assertEquals("uuid", columnType(connection, "media_scene_plans", "scene_id"));
      assertEquals("uuid", columnType(connection, "media_beat_plans", "visual_beat_id"));

      assertTrue(tableExists(connection, "character_version_reference_assets"));
      assertEquals(
          "uuid",
          columnType(connection, "character_version_reference_assets", "character_version_id"));
      assertEquals(
          "uuid", columnType(connection, "character_version_reference_assets", "media_asset_id"));
      assertTrue(tableExists(connection, "local_device_pairing_codes"));
      assertTrue(tableExists(connection, "local_devices"));
      assertTrue(tableExists(connection, "local_device_capabilities"));
      assertTrue(tableExists(connection, "local_media_materializations"));
      assertEquals("uuid", columnType(connection, "local_media_materializations", "project_id"));
      assertEquals("uuid", columnType(connection, "local_media_materializations", "media_asset_id"));
      assertEquals("uuid", columnType(connection, "local_media_materializations", "local_device_id"));
      assertEquals("NO", columnNullable(connection, "local_media_materializations", "local_device_id"));

      assertTrue(tableExists(connection, "project_render_input_snapshots"));
      assertTrue(tableExists(connection, "project_render_input_chapters"));
      assertTrue(tableExists(connection, "project_render_input_beats"));
      assertEquals(
          "uuid", columnType(connection, "project_render_input_snapshots", "generation_job_id"));
      assertEquals(
          "character varying",
          columnType(connection, "project_render_input_snapshots", "execution_target"));
      assertEquals(
          "uuid",
          columnType(connection, "project_render_input_snapshots", "assigned_local_device_id"));
      assertEquals("uuid", columnType(connection, "project_render_input_chapters", "chapter_id"));
      assertEquals("uuid", columnType(connection, "project_render_input_beats", "visual_beat_id"));
      assertTrue(indexExists(connection, "idx_project_render_input_local_claim"));

      assertEquals("bigint", columnType(connection, "projects", "row_version"));
      assertEquals("bigint", columnType(connection, "chapters", "row_version"));
      assertEquals("bigint", columnType(connection, "chapters", "estimated_duration_ms"));
      assertEquals("timestamp with time zone", columnType(connection, "chapters", "deleted_at"));
      assertTrue(indexExists(connection, "uq_chapters_story_order_active"));
      assertTrue(indexExists(connection, "idx_chapters_deleted_at"));

      assertTrue(tableExists(connection, "plan_entitlements"));
      assertTrue(tableExists(connection, "style_presets"));
      assertTrue(tableExists(connection, "voice_catalog"));
      try (PreparedStatement statement =
              connection.prepareStatement(
                  "SELECT COUNT(*) AS total, "
                      + "COUNT(*) FILTER (WHERE (metadata_json ->> 'supportsSpeakingRate')::boolean) "
                      + "AS supported FROM voice_catalog WHERE provider = 'VIENEU' AND enabled = TRUE");
          ResultSet result = statement.executeQuery()) {
        assertTrue(result.next());
        assertTrue(result.getInt("total") > 0);
        assertEquals(result.getInt("total"), result.getInt("supported"));
      }
      assertTrue(tableExists(connection, "notifications"));
      assertTrue(tableExists(connection, "outbox_events"));
    }
  }

  @Test
  void databaseUuidV7FunctionProducesVersion7Identifiers() throws SQLException {
    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement = connection.prepareStatement("select narrativex_uuid_v7()");
        ResultSet result = statement.executeQuery()) {
      assertTrue(result.next());
      UUID generated = result.getObject(1, UUID.class);
      assertEquals(7, generated.version());
      assertEquals(2, generated.variant());
    }
  }

  @Test
  void everyForeignKeyHasTheSamePostgresTypeAsItsReferencedColumn() throws SQLException {
    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement =
            connection.prepareStatement(
                """
                SELECT child.relname AS child_table,
                       child_col.attname AS child_column,
                       format_type(child_col.atttypid, child_col.atttypmod) AS child_type,
                       parent.relname AS parent_table,
                       parent_col.attname AS parent_column,
                       format_type(parent_col.atttypid, parent_col.atttypmod) AS parent_type
                  FROM pg_constraint con
                  JOIN pg_class child ON child.oid = con.conrelid
                  JOIN pg_class parent ON parent.oid = con.confrelid
                  JOIN pg_namespace ns ON ns.oid = child.relnamespace
                  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY ck(attnum, ord) ON TRUE
                  JOIN LATERAL unnest(con.confkey) WITH ORDINALITY pk(attnum, ord) ON pk.ord = ck.ord
                  JOIN pg_attribute child_col ON child_col.attrelid = child.oid AND child_col.attnum = ck.attnum
                  JOIN pg_attribute parent_col ON parent_col.attrelid = parent.oid AND parent_col.attnum = pk.attnum
                 WHERE con.contype = 'f' AND ns.nspname = 'public'
                """)) {
      try (ResultSet result = statement.executeQuery()) {
        int checked = 0;
        while (result.next()) {
          checked++;
          assertEquals(
              result.getString("parent_type"),
              result.getString("child_type"),
              result.getString("child_table")
                  + "."
                  + result.getString("child_column")
                  + " must match "
                  + result.getString("parent_table")
                  + "."
                  + result.getString("parent_column"));
        }
        assertTrue(checked > 0, "expected the schema to contain foreign keys");
      }
    }
  }

  @Test
  void sensitiveMyBatisQueriesExecuteAgainstTheRealMigratedSchema() {
    UUID missingProjectId = UUID.randomUUID();
    UUID missingChapterId = UUID.randomUUID();
    UUID missingVariantId = UUID.randomUUID();

    assertNull(assertDoesNotThrow(() -> projectMapper.findById(missingProjectId)));
    assertNull(
        assertDoesNotThrow(
            () -> chapterWorkspaceMapper.aggregate(missingProjectId, missingChapterId)));
    assertNull(
        assertDoesNotThrow(
            () -> languageDetectionMapper.findLatest(missingVariantId, "0".repeat(64))));
    assertTrue(
        assertDoesNotThrow(() -> notificationMapper.list("missing-user", true, 5)).isEmpty());
    assertTrue(
        assertDoesNotThrow(
                () -> productionTimelineMapper.findChapters(missingProjectId, "missing-user"))
            .isEmpty());
    assertTrue(
        assertDoesNotThrow(
                () -> productionTimelineMapper.findBeats(missingProjectId, "missing-user"))
            .isEmpty());
  }

  private static String latestFlywayVersion(Connection connection) throws SQLException {
    try (PreparedStatement statement =
            connection.prepareStatement(
                "select version from flyway_schema_history where success = true and version is not null order by installed_rank desc limit 1");
        ResultSet result = statement.executeQuery()) {
      assertTrue(result.next());
      return result.getString(1);
    }
  }

  private static int successfulVersionedMigrationCount(Connection connection) throws SQLException {
    try (PreparedStatement statement =
            connection.prepareStatement(
                "select count(*) from flyway_schema_history where success = true and version is not null");
        ResultSet result = statement.executeQuery()) {
      assertTrue(result.next());
      return result.getInt(1);
    }
  }

  private static boolean tableExists(Connection connection, String table) throws SQLException {
    return exists(
        connection,
        "select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = ?)",
        table);
  }

  private static boolean indexExists(Connection connection, String name) throws SQLException {
    return exists(
        connection,
        "select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = ?)",
        name);
  }

  private static boolean triggerExists(Connection connection, String name) throws SQLException {
    return exists(connection, "select exists (select 1 from pg_trigger where tgname = ?)", name);
  }

  private static boolean exists(Connection connection, String sql, String value)
      throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
      statement.setString(1, value);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getBoolean(1);
      }
    }
  }

  private static String columnType(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select data_type from information_schema.columns where table_schema = 'public' and table_name = ? and column_name = ?")) {
      statement.setString(1, table);
      statement.setString(2, column);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next(), table + "." + column + " must exist");
        return result.getString(1);
      }
    }
  }

  private static String columnNullable(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select is_nullable from information_schema.columns where table_schema = 'public' and table_name = ? and column_name = ?")) {
      statement.setString(1, table);
      statement.setString(2, column);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next(), table + "." + column + " must exist");
        return result.getString(1);
      }
    }
  }

  private static int characterMaximumLength(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select character_maximum_length from information_schema.columns where table_schema = 'public' and table_name = ? and column_name = ?")) {
      statement.setString(1, table);
      statement.setString(2, column);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next(), table + "." + column + " must exist");
        return result.getInt(1);
      }
    }
  }

  private static String columnDefault(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select column_default from information_schema.columns where table_schema = 'public' and table_name = ? and column_name = ?")) {
      statement.setString(1, table);
      statement.setString(2, column);
      try (ResultSet result = statement.executeQuery()) {
        assertTrue(result.next(), table + "." + column + " must exist");
        String defaultValue = result.getString(1);
        assertTrue(defaultValue != null, table + "." + column + " must have a default");
        return defaultValue;
      }
    }
  }
}
