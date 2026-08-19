package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.ProjectJpaEntity;
import com.narrativex.backend.feature.project.infrastructure.persistence.mapper.ProjectPersistenceMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.RollbackException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
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
  @Autowired private EntityManagerFactory entityManagerFactory;

  @Test
  void emptyPostgresMigratesAndHibernateValidates() throws SQLException {
    try (Connection connection = dataSource.getConnection()) {
      assertEquals(3, latestFlywayVersion(connection));
      assertEquals("jsonb", columnType(connection, "moderation_decisions", "categories_json"));
      assertTrue(indexExists(connection, "uq_story_versions_one_active_per_project"));
      assertTrue(indexExists(connection, "idx_projects_active_owner_updated_id"));
      assertTrue(columnExists(connection, "chapters", "source_hash"));
      assertEquals("NO", columnNullable(connection, "chapters", "source_text"));
      assertEquals("NO", columnNullable(connection, "chapters", "source_hash"));
      assertTrue(columnExists(connection, "projects", "description"));
      assertTrue(columnExists(connection, "projects", "cover_image_url"));
      assertTrue(indexExists(connection, "idx_generation_jobs_project_status"));
      assertTrue(indexExists(connection, "idx_scenes_chapter_status"));
      assertTrue(tableExists(connection, "project_locations"));
      assertTrue(tableExists(connection, "project_assets"));
      assertTrue(indexExists(connection, "idx_project_locations_active_project"));
      assertTrue(indexExists(connection, "idx_project_assets_active_project"));
      assertFalse(indexExists(connection, "idx_auth_users_email"));
      assertFalse(indexExists(connection, "idx_auth_users_google_subject"));
      assertFalse(columnExists(connection, "story_versions", "rights_attested"));
      assertFalse(columnExists(connection, "story_versions", "rights_policy_version"));
      assertFalse(columnExists(connection, "story_versions", "rights_basis"));
      assertFalse(columnExists(connection, "story_versions", "rights_attested_at"));
      assertFalse(columnExists(connection, "story_versions", "rights_attested_by"));
      assertFalse(tableExists(connection, "content_rights_attestations"));
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
  void hibernateVersionColumnRejectsStaleProjectUpdate() throws SQLException {
    long projectId;
    try (Connection connection = dataSource.getConnection()) {
      projectId = insertProject(connection);
    }

    EntityManager first = entityManagerFactory.createEntityManager();
    EntityManager stale = entityManagerFactory.createEntityManager();
    try {
      first.getTransaction().begin();
      stale.getTransaction().begin();
      ProjectJpaEntity firstEntity = first.find(ProjectJpaEntity.class, projectId);
      ProjectJpaEntity staleEntity = stale.find(ProjectJpaEntity.class, projectId);

      Project firstDomain = ProjectPersistenceMapper.toDomain(firstEntity);
      firstDomain.archive();
      firstEntity.apply(firstDomain);
      first.getTransaction().commit();

      Project staleDomain = ProjectPersistenceMapper.toDomain(staleEntity);
      staleDomain.archive();
      staleEntity.apply(staleDomain);
      assertThrows(RollbackException.class, stale.getTransaction()::commit);
    } finally {
      if (first.getTransaction().isActive()) first.getTransaction().rollback();
      if (stale.getTransaction().isActive()) stale.getTransaction().rollback();
      first.close();
      stale.close();
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
                + "(project_id, version_number, content, source_language, status, moderation_decision) "
                + "values (?, ?, 'story', 'vi-VN', ?, 'PENDING')")) {
      statement.setLong(1, projectId);
      statement.setInt(2, versionNumber);
      statement.setString(3, status);
      statement.executeUpdate();
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
