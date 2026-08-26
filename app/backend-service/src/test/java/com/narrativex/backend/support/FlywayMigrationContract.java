package com.narrativex.backend.support;

import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Shared test-side source of truth for the consolidated Flyway baseline. */
public final class FlywayMigrationContract {
  private static final Pattern VERSIONED_MIGRATION = Pattern.compile("V(\\d+)__.*\\.sql");
  private static final List<String> CANONICAL_MIGRATIONS =
      List.of("V1__create_tables.sql", "V2__init_indexes.sql", "V3__seed_data.sql");

  private FlywayMigrationContract() {}

  public static List<String> canonicalMigrationNames() {
    return CANONICAL_MIGRATIONS;
  }

  public static Path migrationRoot() {
    URL resource = FlywayMigrationContract.class.getClassLoader().getResource("db/migration");
    if (resource == null) {
      throw new IllegalStateException(
          "Flyway migration resources were not found on the test classpath");
    }
    try {
      return Path.of(resource.toURI());
    } catch (URISyntaxException | IllegalArgumentException exception) {
      throw new IllegalStateException(
          "Flyway migration resources must be a file-system directory", exception);
    }
  }

  public static List<String> discoverMigrationNames() throws IOException {
    try (var files = Files.list(migrationRoot())) {
      return files
          .filter(Files::isRegularFile)
          .map(path -> path.getFileName().toString())
          .filter(VERSIONED_MIGRATION.asPredicate())
          .sorted(
              Comparator.comparingInt(FlywayMigrationContract::version).thenComparing(name -> name))
          .toList();
    }
  }

  public static Path migration(String name) {
    if (!CANONICAL_MIGRATIONS.contains(name)) {
      throw new IllegalArgumentException("Unknown canonical Flyway migration: " + name);
    }
    return migrationRoot().resolve(name);
  }

  public static int version(String name) {
    Matcher matcher = VERSIONED_MIGRATION.matcher(name);
    if (!matcher.matches()) {
      throw new IllegalArgumentException("Not a versioned Flyway migration: " + name);
    }
    return Integer.parseInt(matcher.group(1));
  }
}
