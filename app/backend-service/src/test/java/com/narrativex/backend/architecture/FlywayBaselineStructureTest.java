package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import com.narrativex.backend.support.FlywayMigrationContract;
import org.junit.jupiter.api.Test;

/** Guards the final clean Flyway baseline from drifting back into patch-style migrations. */
class FlywayBaselineStructureTest {
  @Test
  void baselineContainsExactlyThreeResponsibilitySeparatedMigrations() throws IOException {
    assertEquals(
        FlywayMigrationContract.canonicalMigrationNames(),
        FlywayMigrationContract.discoverMigrationNames());

    String v1 = Files.readString(FlywayMigrationContract.migration("V1__create_tables.sql"));
    String v2 = Files.readString(FlywayMigrationContract.migration("V2__init_indexes.sql"));
    String v3 = Files.readString(FlywayMigrationContract.migration("V3__seed_data.sql"));

    assertFalse(v1.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v2.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v3.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v3.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v3.matches("(?is).*\\bALTER\\s+TABLE\\b.*"));
  }

  @Test
  void finalV1ContainsFoldedSchemaAndNoPasswordCredentialColumn() throws IOException {
    String v1 = Files.readString(FlywayMigrationContract.migration("V1__create_tables.sql"));

    assertFalse(v1.toLowerCase().contains("password_hash"));
    assertTrue(v1.contains("idempotency_key VARCHAR(512)"));
    assertTrue(v1.contains("reuse_source_visual_beat_id UUID"));
    assertTrue(v1.contains("CREATE TABLE project_render_input_snapshots"));
    assertTrue(v1.contains("execution_target VARCHAR(24) NOT NULL DEFAULT 'CLOUD'"));
    assertTrue(v1.contains("assigned_local_device_id UUID REFERENCES local_devices(id)"));
    assertTrue(v1.contains("NEW.job_type IN ('CHAPTER_RENDER', 'RENDER_PROJECT')"));
  }
}
