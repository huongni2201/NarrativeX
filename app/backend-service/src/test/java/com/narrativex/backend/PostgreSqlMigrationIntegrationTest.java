package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
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
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.data.redis.repositories.enabled", () -> false);
  }

  @Autowired private DataSource dataSource;

  @Test
  void emptyPostgresMigratesAndHibernateValidates() throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      assertEquals(3, latestFlywayVersion(connection));
      assertEquals("jsonb", columnType(connection, "moderation_decisions", "categories_json"));
      assertTrue(indexExists(connection, "uq_story_versions_one_active_per_project"));
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
              SQLException.class,
              () -> insertStoryVersion(connection, projectId, 2, "ACTIVE"));
      assertEquals("23505", duplicateActive.getSQLState());
      connection.rollback();

      SQLException missingProject =
          assertThrows(
              SQLException.class,
              () -> insertStoryVersion(connection, Long.MAX_VALUE, 3, "DRAFT"));
      assertEquals("23503", missingProject.getSQLState());
      connection.rollback();
    }
  }

  private static int latestFlywayVersion(Connection connection) throws SQLException {
    try (PreparedStatement statement =
            connection.prepareStatement(
                "select max(cast(version as integer)) from flyway_schema_history where success = true");
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

  private static boolean indexExists(Connection connection, String indexName) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "select exists(select 1 from pg_indexes where schemaname = 'public' and indexname = ?)")) {
      statement.setString(1, indexName);
      try (ResultSet result = statement.executeQuery()) {
        result.next();
        return result.getBoolean(1);
      }
    }
  }

  private static long insertProject(Connection connection) throws SQLException {
    try (PreparedStatement statement =
        connection.prepareStatement(
            "insert into projects "
                + "(name, owner_id, status, source_language, narration_language, metadata_language, "
                + "image_aspect_ratio, image_quality_tier) "
                + "values ('Project', 'owner', 'DRAFT', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD') "
                + "returning id")) {
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
            "insert into story_versions "
                + "(project_id, version_number, content, source_language, status, moderation_decision, "
                + "rights_attested, rights_policy_version, rights_basis) "
                + "values (?, ?, 'story', 'vi-VN', ?, 'PENDING', false, 'not-required', 'NOT_REQUIRED')")) {
      statement.setLong(1, projectId);
      statement.setInt(2, versionNumber);
      statement.setString(3, status);
      statement.executeUpdate();
    }
  }
}
