package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Savepoint;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.apache.ibatis.executor.parameter.ParameterHandler;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactory;
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
 * Plans every concrete MyBatis mapped statement against the authoritative migrated PostgreSQL
 * schema. EXPLAIN resolves tables and columns without executing the underlying DML.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MyBatisPostgreSqlPlanningIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_mybatis_contract")
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

  @Autowired private DataSource dataSource;
  @Autowired private SqlSessionFactory sqlSessionFactory;

  @Test
  void everyMappedStatementPlansAgainstMigratedPostgresSchema() throws Exception {
    Configuration configuration = sqlSessionFactory.getConfiguration();
    Map<String, Object> parameters = planningParameters();
    List<String> violations = new ArrayList<>();
    int planned = 0;

    try (Connection connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      for (String statementName : configuration.getMappedStatementNames().stream().sorted().toList()) {
        // MyBatis also exposes short-name aliases. Plan only canonical namespace-qualified ids.
        if (!statementName.contains(".")) {
          continue;
        }

        MappedStatement statement = configuration.getMappedStatement(statementName, false);
        BoundSql boundSql;
        try {
          boundSql = statement.getBoundSql(parameters);
        } catch (RuntimeException exception) {
          violations.add(statementName + " [bind]: " + concise(exception));
          continue;
        }

        String sql = boundSql.getSql();
        if (sql == null || sql.isBlank()) {
          violations.add(statementName + " [bind]: produced blank SQL");
          continue;
        }

        Savepoint savepoint = connection.setSavepoint();
        try (PreparedStatement explain = connection.prepareStatement("EXPLAIN " + sql)) {
          ParameterHandler parameterHandler =
              configuration.newParameterHandler(statement, parameters, boundSql);
          parameterHandler.setParameters(explain);
          explain.execute();
          planned++;
        } catch (Exception exception) {
          connection.rollback(savepoint);
          violations.add(statementName + " [plan]: " + concise(exception));
        } finally {
          try {
            connection.releaseSavepoint(savepoint);
          } catch (Exception ignored) {
            // PostgreSQL may already have discarded the savepoint after a rollback; no data is kept.
          }
        }
      }
      connection.rollback();
    }

    assertTrue(planned > 0, "expected at least one MyBatis statement to be planned");
    assertTrue(
        violations.isEmpty(),
        () ->
            "MyBatis statements that do not bind/plan against the migrated PostgreSQL schema:\n"
                + String.join("\n", violations));
  }

  private static Map<String, Object> planningParameters() {
    UUID id = UUID.fromString("00000000-0000-7000-8000-000000000001");
    Map<String, Object> parameters = new HashMap<>();

    // Collections required by the repository's foreach nodes.
    parameters.put("sceneIds", List.of(id));
    parameters.put("statuses", List.of("RUNNING"));
    parameters.put("allowedPrevious", List.of("RUNNING"));

    // Keep optional dynamic predicates disabled unless they are needed to form valid SQL.
    parameters.put("cursor", null);
    parameters.put("cursorCreatedAt", null);
    parameters.put("cursorId", null);
    parameters.put("search", null);
    parameters.put("type", null);

    // A handful of scalar values avoid driver ambiguity in LIMIT/version/state expressions.
    parameters.put("limit", 1);
    parameters.put("rowVersion", 0L);
    parameters.put("expectedVersion", 0L);
    parameters.put("importance", 0);
    parameters.put("status", "RUNNING");
    parameters.put("nextStatus", "RUNNING");

    return parameters;
  }

  private static String concise(Throwable throwable) {
    Throwable root = throwable;
    while (root.getCause() != null) {
      root = root.getCause();
    }
    String message = root.getMessage();
    if (message == null || message.isBlank()) {
      return root.getClass().getSimpleName();
    }
    return root.getClass().getSimpleName() + ": " + message.replace('\n', ' ');
  }
}
