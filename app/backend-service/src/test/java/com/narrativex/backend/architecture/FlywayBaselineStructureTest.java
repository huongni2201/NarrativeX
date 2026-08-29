package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.support.FlywayMigrationContract;
import java.io.IOException;
import java.nio.file.Files;
import org.junit.jupiter.api.Test;

/** Verifies the pre-release PostgreSQL baseline is cleanly separated by responsibility. */
class FlywayBaselineStructureTest {
  @Test
  void migrationSetStaysCanonicalAndResponsibilitySeparated() throws IOException {
    assertEquals(
        FlywayMigrationContract.canonicalMigrationNames(),
        FlywayMigrationContract.discoverMigrationNames());

    String v1 = read("V1__identity_and_access.sql");
    String v2 = read("V2__project_story_and_planning.sql");
    String v3 = read("V3__generation_billing_and_media.sql");
    String v4 = read("V4__narration_notifications_and_artifacts.sql");
    String v5 = read("V5__catalog_generation_and_render_snapshots.sql");
    String v6 = read("V6__database_logic_and_triggers.sql");
    String v7 = read("V7__indexes.sql");
    String v8 = read("V8__seed_catalog.sql");

    for (String schema : new String[] {v1, v2, v3, v4, v5, v6}) {
      assertFalse(schema.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    }
    assertFalse(v7.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v8.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v8.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v8.matches("(?is).*\\bALTER\\s+TABLE\\b.*"));

    assertTrue(v1.contains("CREATE TABLE auth_users"));
    assertTrue(v1.contains("CREATE TABLE desktop_guest_installations"));
    assertTrue(v1.contains("CREATE TABLE desktop_auth_handoffs"));
    assertTrue(v1.contains("CREATE TABLE SPRING_SESSION"));
    assertTrue(v1.contains("CREATE TABLE local_devices"));

    assertTrue(v2.contains("CREATE TABLE projects"));
    assertTrue(v2.contains("CREATE TABLE story_versions"));
    assertTrue(v2.contains("CREATE TABLE scenes"));
    assertTrue(v2.contains("CREATE TABLE media_plans"));
    assertTrue(v2.contains("reuse_source_visual_beat_id UUID"));
    assertTrue(v2.contains("production_mode VARCHAR(32) NOT NULL CHECK (production_mode = 'IMAGE_MOTION')"));
    assertFalse(v2.contains("HYBRID_LOCAL_I2V"));

    assertTrue(v3.contains("CREATE TABLE generation_jobs"));
    assertTrue(v3.contains("idempotency_key VARCHAR(512)"));
    assertTrue(v3.contains("analysis_visual_generation_mode VARCHAR(16)"));
    assertTrue(v3.contains("analysis_image_provider VARCHAR(32)"));
    assertTrue(v3.contains("ck_generation_jobs_analysis_preferences_consistent"));
    assertTrue(v3.contains("CREATE TABLE plan_entitlements"));
    assertTrue(v3.contains("CREATE TABLE production_beat_media_selections"));
    assertTrue(v3.contains("DROP COLUMN preview_asset_id"));
    assertTrue(v3.contains("ADD COLUMN preview_media_asset_id UUID"));
    assertTrue(v3.contains("REFERENCES media_assets(id) ON DELETE SET NULL"));
    assertFalse(v3.contains("STORY_ANALYZE"));
    assertFalse(v3.contains("HYBRID_LOCAL_I2V"));

    assertTrue(v4.contains("CREATE TABLE narration_requests"));
    assertTrue(v4.contains("speaking_rate NUMERIC(8, 4) NOT NULL"));
    assertTrue(v4.contains("CREATE TABLE notifications"));
    assertTrue(v4.contains("CREATE TABLE final_artifacts"));

    assertTrue(v5.contains("CREATE TABLE voice_catalog"));
    assertTrue(v5.contains("CREATE TABLE project_render_input_snapshots"));
    assertTrue(v5.contains("subtitle_text TEXT NOT NULL DEFAULT ''"));
    assertTrue(v5.contains("subtitle_spans_json JSONB"));
    assertTrue(v5.contains("ck_project_render_subtitle_spans_array"));
    assertTrue(v5.contains("media_selection_active BOOLEAN NOT NULL DEFAULT FALSE"));

    assertTrue(v6.contains("CREATE OR REPLACE FUNCTION finalize_quota_reservation_on_job_terminal"));
    assertTrue(v6.contains("CREATE TRIGGER trg_generation_jobs_finalize_quota"));
    assertTrue(v6.contains("NEW.job_type = 'RENDER_PROJECT'"));
    assertFalse(v6.contains("CHAPTER_RENDER"));

    assertTrue(v7.contains("CREATE INDEX idx_desktop_guest_installations_last_seen"));
    assertTrue(v7.contains("CREATE INDEX idx_production_beat_media_selection_asset"));
    assertTrue(v7.contains("CREATE INDEX idx_generation_jobs_chapter_workspace_lookup"));

    assertTrue(v8.contains("'VIENEU'"));
    assertTrue(v8.contains("\"supportsSpeakingRate\":true"));
    assertFalse(v8.contains("\"supportsSpeakingRate\":false"));

    String allSchema = v1 + v2 + v3 + v4 + v5 + v6;
    assertFalse(allSchema.contains("narrativex_uuid_v7"));
    assertFalse(allSchema.contains("CREATE EXTENSION IF NOT EXISTS pgcrypto"));
    assertTrue(allSchema.contains("DEFAULT uuidv7()"));
  }

  @Test
  void storyVersionsDeclareCurrentLifecycleStates() throws IOException {
    String v2 = read("V2__project_story_and_planning.sql");
    String storyVersions =
        v2.substring(
            v2.indexOf("CREATE TABLE story_versions"), v2.indexOf("CREATE TABLE chapters"));

    assertTrue(storyVersions.contains("CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED'))"));
  }

  private static String read(String name) throws IOException {
    return Files.readString(FlywayMigrationContract.migration(name));
  }
}
