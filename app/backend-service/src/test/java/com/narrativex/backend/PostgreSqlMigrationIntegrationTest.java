package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.notification.infrastructure.persistence.mybatis.NotificationMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.LanguageDetectionMapper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
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

/**
 * Contract test for the authoritative PostgreSQL/Flyway schema and MyBatis UUID mappings.
 *
 * <p>The UUID migration deliberately runs the legacy V0 baseline first and then V1. If either the
 * PK/FK conversion or an XML mapping drifts from the Java contract, this test must fail before the
 * application is deployable.
 */
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
          "operation_plans");

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
  @Autowired private ProjectMapper projectMapper;
  @Autowired private ChapterWorkspaceMapper chapterWorkspaceMapper;
  @Autowired private LanguageDetectionMapper languageDetectionMapper;
  @Autowired private NotificationMapper notificationMapper;

  @Test
  void emptyPostgresMigratesThroughAuthoritativeUuidSchema() throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      assertEquals("1", latestFlywayVersion(connection));

      for (String table : UUID_ID_TABLES) {
        assertEquals("uuid", columnType(connection, table, "id"), table + ".id must be UUID");
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
      assertEquals("uuid", columnType(connection, "render_input_snapshots", "project_id"));
      assertEquals("uuid", columnType(connection, "render_input_snapshots", "chapter_id"));
      assertEquals("uuid", columnType(connection, "render_input_snapshots", "generation_job_id"));
      assertEquals("uuid", columnType(connection, "narration_requests", "project_id"));
      assertEquals("uuid", columnType(connection, "narration_requests", "chapter_id"));
      assertEquals("uuid", columnType(connection, "media_generation_items", "generation_job_id"));
      assertEquals("uuid", columnType(connection, "media_generation_items", "provider_operation_id"));
      assertEquals("uuid", columnType(connection, "media_scene_plans", "scene_id"));
      assertEquals("uuid", columnType(connection, "media_beat_plans", "visual_beat_id"));

      // Numeric domain values are not identifiers and must remain numeric.
      assertEquals("bigint", columnType(connection, "projects", "row_version"));
      assertEquals("bigint", columnType(connection, "chapters", "row_version"));
      assertEquals("bigint", columnType(connection, "chapters", "estimated_duration_ms"));

      assertTrue(tableExists(connection, "plan_entitlements"));
      assertTrue(tableExists(connection, "style_presets"));
      assertTrue(tableExists(connection, "voice_catalog"));
      assertFalse(columnExists(connection, "generation_jobs", "references"));
      assertFalse(columnExists(connection, "character_appearances", "references"));
      assertFalse(columnExists(connection, "scene_characters", "references"));
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
                  JOIN LATERAL unnest(con.confkey) WITH ORDINALITY pk(attnum, ord)
                    ON pk.ord = ck.ord
                  JOIN pg_attribute child_col
                    ON child_col.attrelid = child.oid AND child_col.attnum = ck.attnum
                  JOIN pg_attribute parent_col
                    ON parent_col.attrelid = parent.oid AND parent_col.attnum = pk.attnum
                 WHERE con.contype = 'f' AND ns.nspname = 'public'
                """)) {
      try (ResultSet result = statement.executeQuery()) {
        int checked = 0;
        while (result.next()) {
          checked++;
          String childTable = result.getString("child_table");
          String childColumn = result.getString("child_column");
          String childType = result.getString("child_type");
          String parentTable = result.getString("parent_table");
          String parentColumn = result.getString("parent_column");
          String parentType = result.getString("parent_type");
          assertEquals(
              parentType,
              childType,
              childTable + "." + childColumn + " must match " + parentTable + "." + parentColumn);
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
    assertTrue(assertDoesNotThrow(() -> notificationMapper.list("missing-user", true, 5)).isEmpty());
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

  private static boolean tableExists(Connection connection, String table) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = ?)")) {
      statement.setString(1, table);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getBoolean(1);
      }
    }
  }

  private static boolean columnExists(Connection connection, String table, String column)
      throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = ? and column_name = ?)")) {
      statement.setString(1, table);
      statement.setString(2, column);
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
}
