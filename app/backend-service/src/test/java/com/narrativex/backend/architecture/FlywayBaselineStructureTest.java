package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.support.FlywayMigrationContract;
import java.io.IOException;
import java.nio.file.Files;
import org.junit.jupiter.api.Test;

/** Verifies the responsibility split and core contracts of the Flyway baseline. */
class FlywayBaselineStructureTest {
  @Test
  void baselineAndReviewedAdditiveMigrationsStayCanonical() throws IOException {
    assertEquals(
        FlywayMigrationContract.canonicalMigrationNames(),
        FlywayMigrationContract.discoverMigrationNames());

    String v1 = Files.readString(FlywayMigrationContract.migration("V1__create_tables.sql"));
    String v2 = Files.readString(FlywayMigrationContract.migration("V2__init_indexes.sql"));
    String v3 = Files.readString(FlywayMigrationContract.migration("V3__seed_data.sql"));
    String v4 =
        Files.readString(
            FlywayMigrationContract.migration("V4__desktop_guest_installations.sql"));
    String v5 =
        Files.readString(
            FlywayMigrationContract.migration("V5__production_beat_media_selections.sql"));
    String v6 =
        Files.readString(
            FlywayMigrationContract.migration("V6__enable_vieneu_speaking_rate.sql"));

    assertFalse(v1.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v2.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v3.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v3.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v3.matches("(?is).*\\bALTER\\s+TABLE\\b.*"));
    assertTrue(v4.contains("CREATE TABLE desktop_guest_installations"));
    assertTrue(v4.contains("CREATE INDEX idx_desktop_guest_installations_last_seen"));
    assertFalse(v4.matches("(?is).*\\bINSERT\\s+INTO\\b.*"));
    assertTrue(v5.contains("CREATE TABLE production_beat_media_selections"));
    assertTrue(v5.contains("ALTER TABLE project_render_input_beats"));
    assertTrue(v6.contains("UPDATE voice_catalog"));
    assertTrue(v6.contains("supportsSpeakingRate"));
  }

  @Test
  void v1ContainsCoreSchemaContracts() throws IOException {
    String v1 = Files.readString(FlywayMigrationContract.migration("V1__create_tables.sql"));

    assertTrue(v1.contains("idempotency_key VARCHAR(512)"));
    assertTrue(v1.contains("reuse_source_visual_beat_id UUID"));
    assertTrue(v1.contains("CREATE TABLE project_render_input_snapshots"));
    assertTrue(v1.contains("execution_target VARCHAR(24) NOT NULL DEFAULT 'CLOUD'"));
    assertTrue(v1.contains("assigned_local_device_id UUID REFERENCES local_devices(id)"));
    assertTrue(v1.contains("NEW.job_type IN ('CHAPTER_RENDER', 'RENDER_PROJECT')"));
  }

  @Test
  void storyVersionsDeclareCurrentLifecycleStates() throws IOException {
    String v1 = Files.readString(FlywayMigrationContract.migration("V1__create_tables.sql"));
    String storyVersions =
        v1.substring(
            v1.indexOf("CREATE TABLE story_versions"), v1.indexOf("CREATE TABLE chapters"));

    assertTrue(storyVersions.contains("CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED'))"));
  }
}
