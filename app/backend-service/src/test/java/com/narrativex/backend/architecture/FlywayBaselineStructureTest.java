package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Guards the final clean Flyway baseline from drifting back into patch-style migrations. */
class FlywayBaselineStructureTest {
  private static final Path MIGRATION_ROOT = Path.of("src/main/resources/db/migration");
  private static final Path V1 = MIGRATION_ROOT.resolve("V1__create_tables.sql");
  private static final Path V2 = MIGRATION_ROOT.resolve("V2__init_indexes.sql");
  private static final Path V3 = MIGRATION_ROOT.resolve("V3__seed_data.sql");

  @Test
  void baselineContainsExactlyThreeResponsibilitySeparatedMigrations() throws IOException {
    List<String> migrationNames;
    try (var files = Files.list(MIGRATION_ROOT)) {
      migrationNames =
          files
              .filter(Files::isRegularFile)
              .map(path -> path.getFileName().toString())
              .filter(name -> name.matches("V\\d+__.*\\.sql"))
              .sorted()
              .toList();
    }

    assertEquals(
        List.of("V1__create_tables.sql", "V2__init_indexes.sql", "V3__seed_data.sql"),
        migrationNames);

    String v1 = Files.readString(V1);
    String v2 = Files.readString(V2);
    String v3 = Files.readString(V3);

    assertFalse(v1.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v2.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v3.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v3.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v3.matches("(?is).*\\bALTER\\s+TABLE\\b.*"));
  }

  @Test
  void finalV1ContainsFoldedSchemaAndNoPasswordCredentialColumn() throws IOException {
    String v1 = Files.readString(V1);

    assertFalse(v1.toLowerCase().contains("password_hash"));
    assertTrue(v1.contains("idempotency_key VARCHAR(512)"));
    assertTrue(v1.contains("reuse_source_visual_beat_id UUID"));
    assertTrue(v1.contains("CREATE TABLE project_render_input_snapshots"));
    assertTrue(v1.contains("execution_target VARCHAR(24) NOT NULL DEFAULT 'CLOUD'"));
    assertTrue(v1.contains("assigned_local_device_id UUID REFERENCES local_devices(id)"));
    assertTrue(v1.contains("NEW.job_type IN ('CHAPTER_RENDER', 'RENDER_PROJECT')"));
  }
}
