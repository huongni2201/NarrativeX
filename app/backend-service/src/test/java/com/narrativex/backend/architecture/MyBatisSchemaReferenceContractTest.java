package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** Static contract between the authoritative Flyway table baseline and every MyBatis XML mapper. */
class MyBatisSchemaReferenceContractTest {
  private static final Path CREATE_TABLES_MIGRATION =
      Path.of("src/main/resources/db/migration/V1__create_tables.sql");
  private static final Path MAPPER_ROOT = Path.of("src/main/resources/mybatis");

  private static final Pattern CREATE_TABLE =
      Pattern.compile(
          "(?im)^\\s*CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+([a-z_][a-z0-9_]*)\\b");
  private static final Pattern TABLE_REFERENCE =
      Pattern.compile(
          "(?i)\\b(?:FROM|JOIN|UPDATE|INSERT\\s+INTO|DELETE\\s+FROM)\\s+([a-z_][a-z0-9_]*)\\b");
  private static final Pattern RETIRED_REFERENCES_COLUMN = Pattern.compile("(?i)\\breferences\\b");

  private static final Set<String> SQL_REFERENCE_KEYWORDS = Set.of("lateral");

  @Test
  void everyMyBatisTableReferenceExistsInAuthoritativeBaseline() throws IOException {
    Set<String> schemaTables = schemaTables();
    assertFalse(schemaTables.isEmpty(), "expected V1 create-tables migration to define tables");

    List<String> violations = new ArrayList<>();
    for (Path mapper : mapperFiles()) {
      String sql = Files.readString(mapper);
      Matcher matcher = TABLE_REFERENCE.matcher(sql);
      while (matcher.find()) {
        String table = matcher.group(1).toLowerCase(Locale.ROOT);
        if (SQL_REFERENCE_KEYWORDS.contains(table) || isFunctionCall(sql, matcher.end(1))) {
          continue;
        }
        if (!schemaTables.contains(table)) {
          violations.add(MAPPER_ROOT.relativize(mapper) + " -> " + table);
        }
      }
    }

    assertTrue(
        violations.isEmpty(),
        () -> "MyBatis references tables missing from V1 create-tables baseline: " + violations);
  }

  @Test
  void retiredReferencesColumnCannotReturnToMyBatisSql() throws IOException {
    List<String> violations = new ArrayList<>();
    for (Path mapper : mapperFiles()) {
      String sql = Files.readString(mapper);
      if (RETIRED_REFERENCES_COLUMN.matcher(sql).find()) {
        violations.add(MAPPER_ROOT.relativize(mapper).toString());
      }
    }

    assertTrue(
        violations.isEmpty(),
        () -> "Retired `references` column found in MyBatis mapper(s): " + violations);
  }

  private static Set<String> schemaTables() throws IOException {
    String migration = Files.readString(CREATE_TABLES_MIGRATION);
    Matcher matcher = CREATE_TABLE.matcher(migration);
    Set<String> tables = new HashSet<>();
    while (matcher.find()) {
      tables.add(matcher.group(1).toLowerCase(Locale.ROOT));
    }
    return tables;
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

  private static boolean isFunctionCall(String sql, int identifierEnd) {
    for (int index = identifierEnd; index < sql.length(); index++) {
      char current = sql.charAt(index);
      if (Character.isWhitespace(current)) {
        continue;
      }
      return current == '(';
    }
    return false;
  }
}
