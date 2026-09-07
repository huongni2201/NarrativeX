package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.support.FlywayMigrationContract;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** Static contract between the authoritative Flyway schema and every MyBatis XML mapper. */
class MyBatisSchemaReferenceContractTest {
  private static final Path MAPPER_ROOT = Path.of("src/main/resources/mybatis");

  private static final Pattern CREATE_TABLE =
      Pattern.compile(
          "(?im)^\\s*CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+([a-z_][a-z0-9_]*)\\b");
  private static final Pattern DROP_TABLE =
      Pattern.compile(
          "(?im)^\\s*DROP\\s+TABLE(?:\\s+IF\\s+EXISTS)?\\s+([a-z_][a-z0-9_]*)\\b");
  private static final Pattern CREATE_TABLE_BLOCK =
      Pattern.compile(
          "(?is)CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+([a-z_][a-z0-9_]*)\\s*\\((.*?)\\n\\);");
  private static final Pattern COLUMN_DEFINITION =
      Pattern.compile(
          "(?im)^\\s*([a-z_][a-z0-9_]*)\\s+(?:BIGSERIAL|BIGINT|BOOLEAN|CHAR|INTEGER|JSONB|NUMERIC|SMALLINT|TEXT|TIMESTAMP|TIMESTAMPTZ|UUID|VARCHAR)\\b");
  private static final Pattern ALTER_TABLE_BLOCK =
      Pattern.compile("(?is)ALTER\\s+TABLE\\s+([a-z_][a-z0-9_]*)\\s+(.*?);");
  private static final Pattern ADD_COLUMN =
      Pattern.compile("(?i)ADD\\s+COLUMN(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+([a-z_][a-z0-9_]*)\\b");
  private static final Pattern DROP_COLUMN =
      Pattern.compile("(?i)DROP\\s+COLUMN(?:\\s+IF\\s+EXISTS)?\\s+([a-z_][a-z0-9_]*)\\b");
  private static final Pattern TABLE_REFERENCE =
      Pattern.compile(
          "(?i)\\b(?:FROM|JOIN|UPDATE|INSERT\\s+INTO|DELETE\\s+FROM)\\s+([a-z_][a-z0-9_]*)\\b");
  private static final Pattern TABLE_ALIAS =
      Pattern.compile(
          "(?i)\\b(?:FROM|JOIN|UPDATE)\\s+([a-z_][a-z0-9_]*)\\s+(?:AS\\s+)?([a-z_][a-z0-9_]*)\\b");
  private static final Pattern QUALIFIED_COLUMN =
      Pattern.compile("(?i)\\b([a-z_][a-z0-9_]*)\\.([a-z_][a-z0-9_]*)\\b");
  private static final Pattern INSERT_COLUMNS =
      Pattern.compile(
          "(?is)\\bINSERT\\s+INTO\\s+([a-z_][a-z0-9_]*)\\s*\\((.*?)\\)\\s*(?:VALUES|SELECT)");
  private static final Pattern UPDATE_SET =
      Pattern.compile(
          "(?is)\\bUPDATE\\s+([a-z_][a-z0-9_]*)(?:\\s+(?:AS\\s+)?([a-z_][a-z0-9_]*))?\\s+SET\\s+(.*?)(?=\\bWHERE\\b|\\bRETURNING\\b|$)");
  private static final Pattern ASSIGNMENT_COLUMN =
      Pattern.compile("(?i)(?:^|,)\\s*([a-z_][a-z0-9_]*)\\s*=");
  private static final Pattern XML_TAG = Pattern.compile("(?s)<[^>]*>");
  private static final Pattern MYBATIS_PARAMETER = Pattern.compile("(?s)[#$]\\{[^}]*}");
  private static final Pattern COMMON_TABLE_EXPRESSION =
      Pattern.compile("(?i)(?:\\bWITH\\b|,)\\s*(?:RECURSIVE\\s+)?([a-z_][a-z0-9_]*)\\s+AS\\s*\\(");

  private static final Set<String> SQL_REFERENCE_KEYWORDS =
      Set.of(
          "cross",
          "full",
          "group",
          "inner",
          "insert",
          "lateral",
          "left",
          "limit",
          "of",
          "offset",
          "on",
          "order",
          "returning",
          "right",
          "select",
          "set",
          "skip",
          "where");

  @Test
  void everyMyBatisTableReferenceExistsInAuthoritativeBaseline() throws IOException {
    Set<String> schemaTables = schemaTables();
    assertFalse(schemaTables.isEmpty(), "expected Flyway baseline to define tables");

    List<String> violations = new ArrayList<>();
    for (Path mapper : mapperFiles()) {
      String sql = mapperSql(mapper);
      Set<String> commonTableExpressions = commonTableExpressions(sql);
      Matcher matcher = TABLE_REFERENCE.matcher(sql);
      while (matcher.find()) {
        String table = matcher.group(1).toLowerCase(Locale.ROOT);
        if (commonTableExpressions.contains(table)
            || SQL_REFERENCE_KEYWORDS.contains(table)
            || isFunctionCall(sql, matcher.end(1))) {
          continue;
        }
        if (!schemaTables.contains(table)) {
          violations.add(MAPPER_ROOT.relativize(mapper) + " -> table " + table);
        }
      }
    }

    assertTrue(
        violations.isEmpty(),
        () -> "MyBatis references tables missing from Flyway schema: " + violations);
  }

  @Test
  void myBatisQualifiedAndWriteColumnsExistInAuthoritativeBaseline() throws IOException {
    Map<String, Set<String>> schemaColumns = schemaColumns();
    assertFalse(schemaColumns.isEmpty(), "expected Flyway schema to define columns");

    List<String> violations = new ArrayList<>();
    for (Path mapper : mapperFiles()) {
      String sql = mapperSql(mapper);
      Set<String> commonTableExpressions = commonTableExpressions(sql);
      Map<String, String> aliases =
          tableAliases(sql, schemaColumns.keySet(), commonTableExpressions);

      Matcher qualified = QUALIFIED_COLUMN.matcher(sql);
      while (qualified.find()) {
        String qualifier = qualified.group(1).toLowerCase(Locale.ROOT);
        String column = qualified.group(2).toLowerCase(Locale.ROOT);
        String table = aliases.get(qualifier);
        if (table != null && !schemaColumns.get(table).contains(column)) {
          violations.add(
              MAPPER_ROOT.relativize(mapper)
                  + " -> "
                  + qualifier
                  + "."
                  + column
                  + " ("
                  + table
                  + ")");
        }
      }

      Matcher insert = INSERT_COLUMNS.matcher(sql);
      while (insert.find()) {
        String table = insert.group(1).toLowerCase(Locale.ROOT);
        Set<String> columns = schemaColumns.get(table);
        if (columns == null) continue;
        for (String rawColumn : insert.group(2).split(",")) {
          String column = normalizeColumn(rawColumn);
          if (!column.isEmpty() && !columns.contains(column)) {
            violations.add(MAPPER_ROOT.relativize(mapper) + " -> " + table + "." + column);
          }
        }
      }

      Matcher update = UPDATE_SET.matcher(sql);
      while (update.find()) {
        String table = update.group(1).toLowerCase(Locale.ROOT);
        Set<String> columns = schemaColumns.get(table);
        if (columns == null) continue;
        Matcher assignment = ASSIGNMENT_COLUMN.matcher(update.group(3));
        while (assignment.find()) {
          String column = assignment.group(1).toLowerCase(Locale.ROOT);
          if (!columns.contains(column)) {
            violations.add(MAPPER_ROOT.relativize(mapper) + " -> " + table + "." + column);
          }
        }
      }
    }

    assertTrue(
        violations.isEmpty(),
        () -> "MyBatis references columns missing from Flyway schema: " + violations);
  }

  @Test
  void finalSchemaModelAppliesCameraAndShortClipRemovals() throws IOException {
    Map<String, Set<String>> columns = schemaColumns();
    assertFalse(columns.containsKey("short_clip_requests"));
    assertFalse(columns.get("visual_beats").contains("camera_movement"));
    assertFalse(columns.get("visual_beats").contains("camera_angle"));
  }

  private static String mapperSql(Path mapper) throws IOException {
    String withoutXml = XML_TAG.matcher(Files.readString(mapper)).replaceAll(" ");
    return MYBATIS_PARAMETER.matcher(withoutXml).replaceAll(" ? ");
  }

  private static Set<String> schemaTables() throws IOException {
    Set<String> tables = new HashSet<>();
    for (String name : FlywayMigrationContract.canonicalMigrationNames()) {
      String migration = Files.readString(FlywayMigrationContract.migration(name));
      Matcher created = CREATE_TABLE.matcher(migration);
      while (created.find()) {
        tables.add(created.group(1).toLowerCase(Locale.ROOT));
      }
      Matcher dropped = DROP_TABLE.matcher(migration);
      while (dropped.find()) {
        tables.remove(dropped.group(1).toLowerCase(Locale.ROOT));
      }
    }
    return tables;
  }

  private static Map<String, Set<String>> schemaColumns() throws IOException {
    Map<String, Set<String>> tables = new HashMap<>();

    for (String name : FlywayMigrationContract.canonicalMigrationNames()) {
      String migration = Files.readString(FlywayMigrationContract.migration(name));

      Matcher tableMatcher = CREATE_TABLE_BLOCK.matcher(migration);
      while (tableMatcher.find()) {
        String table = tableMatcher.group(1).toLowerCase(Locale.ROOT);
        Matcher columnMatcher = COLUMN_DEFINITION.matcher(tableMatcher.group(2));
        Set<String> columns = new HashSet<>();
        while (columnMatcher.find()) {
          columns.add(columnMatcher.group(1).toLowerCase(Locale.ROOT));
        }
        tables.put(table, columns);
      }

      Matcher alter = ALTER_TABLE_BLOCK.matcher(migration);
      while (alter.find()) {
        Set<String> columns = tables.get(alter.group(1).toLowerCase(Locale.ROOT));
        if (columns == null) continue;
        Matcher added = ADD_COLUMN.matcher(alter.group(2));
        while (added.find()) {
          columns.add(added.group(1).toLowerCase(Locale.ROOT));
        }
        Matcher dropped = DROP_COLUMN.matcher(alter.group(2));
        while (dropped.find()) {
          columns.remove(dropped.group(1).toLowerCase(Locale.ROOT));
        }
      }

      Matcher droppedTable = DROP_TABLE.matcher(migration);
      while (droppedTable.find()) {
        tables.remove(droppedTable.group(1).toLowerCase(Locale.ROOT));
      }
    }
    return tables;
  }

  private static Map<String, String> tableAliases(
      String sql, Set<String> schemaTables, Set<String> commonTableExpressions) {
    Map<String, String> aliases = new HashMap<>();

    Matcher references = TABLE_REFERENCE.matcher(sql);
    while (references.find()) {
      String table = references.group(1).toLowerCase(Locale.ROOT);
      if (schemaTables.contains(table)) aliases.put(table, table);
    }

    Matcher aliasMatcher = TABLE_ALIAS.matcher(sql);
    while (aliasMatcher.find()) {
      String table = aliasMatcher.group(1).toLowerCase(Locale.ROOT);
      String alias = aliasMatcher.group(2).toLowerCase(Locale.ROOT);
      if (schemaTables.contains(table)
          && !commonTableExpressions.contains(table)
          && !SQL_REFERENCE_KEYWORDS.contains(alias)) {
        aliases.put(alias, table);
      }
    }
    return aliases;
  }

  private static Set<String> commonTableExpressions(String sql) {
    Matcher matcher = COMMON_TABLE_EXPRESSION.matcher(sql);
    Set<String> names = new HashSet<>();
    while (matcher.find()) names.add(matcher.group(1).toLowerCase(Locale.ROOT));
    return names;
  }

  private static List<Path> mapperFiles() throws IOException {
    try (Stream<Path> paths = Files.walk(MAPPER_ROOT)) {
      return paths
          .filter(Files::isRegularFile)
          .filter(path -> path.toString().endsWith(".xml"))
          .sorted()
          .toList();
    }
  }

  private static String normalizeColumn(String rawColumn) {
    return rawColumn.trim().replace("\"", "").toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
  }

  private static boolean isFunctionCall(String sql, int identifierEnd) {
    for (int index = identifierEnd; index < sql.length(); index++) {
      char current = sql.charAt(index);
      if (Character.isWhitespace(current)) continue;
      return current == '(';
    }
    return false;
  }
}
