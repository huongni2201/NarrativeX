package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.account.infrastructure.persistence.mybatis.QuotaMapper;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Savepoint;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.reflection.ParamNameResolver;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PGobject;
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
    List<String> violations = new ArrayList<>();
    List<String> reportRows = new ArrayList<>();
    int plannedStatements = 0;
    try (Connection connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      for (String statementName :
          configuration.getMappedStatementNames().stream().sorted().toList()) {
        // MyBatis also exposes short-name aliases. Plan only canonical namespace-qualified ids.
        if (!statementName.contains(".")) {
          continue;
        }

        MappedStatement statement = configuration.getMappedStatement(statementName, false);
        boolean statementPlanned = false;
        for (String planningCase : List.of("defaults", "dynamic-branches")) {
          Object statementParameters = planningParameters(configuration, statement, planningCase);
          BoundSql boundSql;
          try {
            boundSql = statement.getBoundSql(statementParameters);
          } catch (RuntimeException exception) {
            String message = statementName + " [" + planningCase + "] bind: " + concise(exception);
            violations.add(message);
            reportRows.add(reportRow(statement, planningCase, "BIND_FAILED", message));
            continue;
          }

          String sql = boundSql.getSql();
          if (sql == null || sql.isBlank()) {
            String message = statementName + " [" + planningCase + "] bind: produced blank SQL";
            violations.add(message);
            reportRows.add(reportRow(statement, planningCase, "BIND_FAILED", message));
            continue;
          }

          Savepoint savepoint = connection.setSavepoint();
          try (PreparedStatement explain = connection.prepareStatement("EXPLAIN " + sql)) {
            bindPlanningParameters(connection, explain, boundSql, statementParameters);
            explain.execute();
            statementPlanned = true;
            reportRows.add(reportRow(statement, planningCase, "PLANNED", ""));
          } catch (Exception exception) {
            connection.rollback(savepoint);
            String message =
                statementName
                    + " ["
                    + planningCase
                    + "] plan: "
                    + concise(exception)
                    + " bindings="
                    + bindingSummary(boundSql, statementParameters);
            violations.add(message);
            reportRows.add(reportRow(statement, planningCase, "PLAN_FAILED", message));
          } finally {
            try {
              connection.releaseSavepoint(savepoint);
            } catch (Exception ignored) {
              // PostgreSQL may already have discarded the savepoint after a rollback; no data is
              // kept.
            }
          }
        }
        if (statementPlanned) plannedStatements++;
      }
      connection.rollback();
    }

    writeReport(reportRows);
    assertTrue(plannedStatements > 0, "expected at least one MyBatis statement to be planned");
    assertTrue(
        violations.isEmpty(),
        () ->
            "MyBatis statements that do not bind/plan against the migrated PostgreSQL schema:\n"
                + String.join("\n", violations));
  }

  @Test
  void representativeMutationExecutesAndRollsBackAgainstPostgres() throws Exception {
    String userId = "mybatis-contract-rollback";
    String periodKey = "2099-01";
    MappedStatement mutation =
        sqlSessionFactory
            .getConfiguration()
            .getMappedStatement(QuotaMapper.class.getName() + ".ensureUsageWindow");
    Map<String, Object> parameters = Map.of("userId", userId, "periodKey", periodKey);
    BoundSql boundSql = mutation.getBoundSql(parameters);
    try (Connection connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      try (PreparedStatement statement = connection.prepareStatement(boundSql.getSql())) {
        bindPlanningParameters(connection, statement, boundSql, parameters);
        assertEquals(1, statement.executeUpdate());
        assertEquals(0, statement.executeUpdate(), "ON CONFLICT branch must be executable");
      }
      connection.rollback();
    }

    try (Connection connection = dataSource.getConnection();
        PreparedStatement statement =
            connection.prepareStatement(
                "SELECT COUNT(*) FROM usage_windows WHERE user_id = ? AND period_key = ?")) {
      statement.setString(1, userId);
      statement.setString(2, periodKey);
      var result = statement.executeQuery();
      assertTrue(result.next());
      assertEquals(0, result.getInt(1), "rollback fixture must not leave durable rows");
    }
    writeMutationReport();
  }

  private static Object planningParameters(
      Configuration configuration, MappedStatement statement, String planningCase)
      throws Exception {
    String statementId = statement.getId();
    int separator = statementId.lastIndexOf('.');
    Class<?> mapperType = Class.forName(statementId.substring(0, separator));
    String methodName = statementId.substring(separator + 1);
    Method method =
        Arrays.stream(mapperType.getMethods())
            .filter(candidate -> candidate.getName().equals(methodName))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("No mapper method for " + statementId));
    Object[] arguments =
        Arrays.stream(method.getParameters())
            .map(
                parameter ->
                    fixtureValue(
                        parameter.getParameterizedType(), parameter.getName(), planningCase))
            .toArray();
    return new ParamNameResolver(configuration, method).getNamedParams(arguments);
  }

  private static Object fixtureValue(Class<?> type, String property, String planningCase) {
    String normalized = property.toLowerCase();
    if ("defaults".equals(planningCase) && isOptionalParameter(normalized, type)) return null;
    if (type == UUID.class) return fixtureUuid();
    if (type == Instant.class) return Instant.parse("2025-01-01T00:00:00Z");
    if (type == OffsetDateTime.class) return OffsetDateTime.parse("2025-01-01T00:00:00Z");
    if (type == String.class) return fixtureString(property);
    if (type == BigDecimal.class) return BigDecimal.ONE;
    if (type == boolean.class || type == Boolean.class) return true;
    if (type == int.class || type == Integer.class) return 1;
    if (type == long.class || type == Long.class) return 1L;
    if (type == List.class) {
      return normalized.contains("status") || normalized.contains("type")
          ? List.of("RUNNING")
          : List.of(fixtureUuid());
    }
    if (type == Map.class) return Map.of("fixture", true);
    if (type.isEnum()) return type.getEnumConstants()[0];
    if (type == Object.class) return fixtureForProperty(property);
    return instantiateFixture(type, planningCase);
  }

  private static boolean isOptionalParameter(String normalized, Class<?> type) {
    if (type.isPrimitive()) return false;
    return normalized.contains("cursor")
        || normalized.equals("search")
        || normalized.equals("query")
        || normalized.equals("type")
        || normalized.equals("statuses")
        || normalized.equals("statusfilter");
  }

  private static Object fixtureValue(Type type, String property, String planningCase) {
    if (type instanceof ParameterizedType parameterizedType
        && parameterizedType.getRawType() == List.class
        && parameterizedType.getActualTypeArguments().length == 1) {
      Type elementType = parameterizedType.getActualTypeArguments()[0];
      if (elementType instanceof Class<?> elementClass) {
        return List.of(fixtureValue(elementClass, property + "Item", planningCase));
      }
    }
    return fixtureValue(
        type instanceof Class<?> clazz ? clazz : Object.class, property, planningCase);
  }

  private static Object instantiateFixture(Class<?> type, String planningCase) {
    try {
      Constructor<?> noArg =
          Arrays.stream(type.getDeclaredConstructors())
              .filter(constructor -> constructor.getParameterCount() == 0)
              .findFirst()
              .orElse(null);
      if (noArg != null) {
        noArg.setAccessible(true);
        Object value = noArg.newInstance();
        for (Method method : type.getMethods()) {
          if (method.getName().startsWith("set") && method.getParameterCount() == 1) {
            String property =
                Character.toLowerCase(method.getName().charAt(3)) + method.getName().substring(4);
            method.invoke(
                value, fixtureValue(method.getParameterTypes()[0], property, planningCase));
          }
        }
        return value;
      }
      Constructor<?> constructor =
          Arrays.stream(type.getDeclaredConstructors())
              .max(
                  (left, right) ->
                      Integer.compare(left.getParameterCount(), right.getParameterCount()))
              .orElseThrow();
      constructor.setAccessible(true);
      Field[] fields =
          Arrays.stream(type.getDeclaredFields())
              .filter(field -> !Modifier.isStatic(field.getModifiers()))
              .toArray(Field[]::new);
      Object[] values = new Object[constructor.getParameterCount()];
      for (int index = 0; index < values.length; index++) {
        String property = index < fields.length ? fields[index].getName() : "value" + index;
        values[index] =
            fixtureValue(constructor.getParameterTypes()[index], property, planningCase);
      }
      return constructor.newInstance(values);
    } catch (Exception exception) {
      throw new IllegalStateException(
          "Cannot create MyBatis fixture for " + type.getName(), exception);
    }
  }

  private static UUID fixtureUuid() {
    return UUID.fromString("00000000-0000-7000-8000-000000000001");
  }

  private static String fixtureString(String property) {
    String normalized = property.toLowerCase();
    if (normalized.equals("jobid") || normalized.endsWith("jobid")) return fixtureUuid().toString();
    if (normalized.contains("json")
        || normalized.contains("metadata")
        || normalized.contains("aliases")) {
      return "{\"fixture\":true}";
    }
    if (normalized.contains("owner")
        || normalized.contains("userid")
        || normalized.contains("accountid")) {
      return "missing-user";
    }
    if (normalized.contains("status")
        || normalized.contains("state")
        || normalized.contains("type")) return "RUNNING";
    if (normalized.endsWith("at") || normalized.endsWith("time")) return "2025-01-01T00:00:00Z";
    return "fixture";
  }

  private static Object fixtureForProperty(String property) {
    String normalized = property.toLowerCase();
    if (normalized.endsWith("id") || normalized.equals("id")) return fixtureUuid();
    if (normalized.endsWith("at") || normalized.endsWith("time"))
      return Instant.parse("2025-01-01T00:00:00Z");
    if (normalized.contains("cost")
        || normalized.contains("amount")
        || normalized.contains("score")) return BigDecimal.ONE;
    if (normalized.contains("version")
        || normalized.contains("limit")
        || normalized.contains("count")) return 1L;
    return fixtureString(property);
  }

  /**
   * Bind planning fixtures with PostgreSQL JDBC types. The purpose of this contract is schema
   * planning, so it must not depend on whether a sparse synthetic map happens to match a domain
   * record's MyBatis type handler exactly.
   */
  private static void bindPlanningParameters(
      Connection connection, PreparedStatement statement, BoundSql boundSql, Object parameters)
      throws Exception {
    int index = 1;
    var metaObject = SystemMetaObject.forObject(parameters);
    for (var mapping : boundSql.getParameterMappings()) {
      String property = mapping.getProperty();
      Object value =
          boundSql.hasAdditionalParameter(property)
              ? boundSql.getAdditionalParameter(property)
              : metaObject.hasGetter(property) ? metaObject.getValue(property) : null;
      bindPlanningValue(connection, statement, index++, property, value);
    }
  }

  private static String bindingSummary(BoundSql boundSql, Object parameters) {
    var metaObject = SystemMetaObject.forObject(parameters);
    List<String> values = new ArrayList<>();
    for (var mapping : boundSql.getParameterMappings()) {
      String property = mapping.getProperty();
      Object value =
          boundSql.hasAdditionalParameter(property)
              ? boundSql.getAdditionalParameter(property)
              : metaObject.hasGetter(property) ? metaObject.getValue(property) : null;
      values.add(property + "=" + (value == null ? "null" : value.getClass().getSimpleName()));
    }
    return String.join(",", values);
  }

  private static void bindPlanningValue(
      Connection connection, PreparedStatement statement, int index, String property, Object value)
      throws Exception {
    if (value == null) {
      statement.setNull(index, Types.VARCHAR);
    } else if (value instanceof UUID) {
      statement.setObject(index, value, Types.OTHER);
    } else if (value instanceof Instant instant) {
      statement.setObject(index, OffsetDateTime.ofInstant(instant, ZoneOffset.UTC));
    } else if (value instanceof OffsetDateTime) {
      statement.setObject(index, value);
    } else if (value instanceof BigDecimal) {
      statement.setBigDecimal(index, (BigDecimal) value);
    } else if (value instanceof Integer) {
      statement.setInt(index, (Integer) value);
    } else if (value instanceof Long) {
      statement.setLong(index, (Long) value);
    } else if (value instanceof Boolean) {
      statement.setBoolean(index, (Boolean) value);
    } else if (value instanceof List<?> list) {
      String elementType =
          list.stream().anyMatch(item -> item instanceof UUID) ? "uuid" : "varchar";
      Object[] elements =
          list.stream()
              .map(item -> item instanceof UUID ? item.toString() : String.valueOf(item))
              .toArray();
      statement.setArray(index, connection.createArrayOf(elementType, elements));
    } else if (value instanceof Map<?, ?>) {
      PGobject json = new PGobject();
      json.setType("jsonb");
      json.setValue("{\"fixture\":true}");
      statement.setObject(index, json);
    } else if (value.getClass().isEnum()) {
      statement.setString(index, boundedText(((Enum<?>) value).name()));
    } else {
      String text = String.valueOf(value);
      statement.setString(
          index, property.toLowerCase().endsWith("jobid") ? text : boundedText(text));
    }
  }

  private static String boundedText(String value) {
    return value.length() <= 16 ? value : value.substring(0, 16);
  }

  private static String reportRow(
      MappedStatement statement, String caseName, String status, String result) {
    String safeResult = result.replace("|", "\\|").replace("\n", " ");
    return "| `"
        + statement.getId()
        + "` | "
        + statement.getSqlCommandType()
        + " | "
        + caseName
        + " | "
        + status
        + " | "
        + safeResult
        + " |";
  }

  private static void writeReport(List<String> reportRows) throws Exception {
    Path report = Path.of("target/mybatis-postgresql-mapping-report.md");
    Files.createDirectories(report.getParent());
    List<String> output = new ArrayList<>();
    output.add("# MyBatis PostgreSQL mapping report");
    output.add("");
    output.add(
        "Generated by `MyBatisPostgreSqlPlanningIntegrationTest`; each statement is bound and planned against the migrated PostgreSQL schema for both default and dynamic-branch fixtures.");
    output.add("");
    output.add("| Mapper | Statement | Planned/Executed | Result |");
    output.add("| --- | --- | --- | --- |");
    output.addAll(reportRows);
    Files.writeString(report, String.join("\n", output) + "\n");
  }

  private static void writeMutationReport() throws Exception {
    Path report = Path.of("target/mybatis-postgresql-mutation-execution-report.md");
    Files.createDirectories(report.getParent());
    Files.writeString(
        report,
        "# MyBatis PostgreSQL mutation execution report\n\n"
            + "| Mapper | Statement | Result |\n| --- | --- | --- |\n"
            + "| `"
            + QuotaMapper.class.getName()
            + ".ensureUsageWindow` | INSERT / ON CONFLICT | EXECUTED_ROLLBACK_PASS |\n");
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
