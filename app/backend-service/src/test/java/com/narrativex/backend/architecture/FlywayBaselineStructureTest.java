package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.support.FlywayMigrationContract;
import java.io.IOException;
import java.nio.file.Files;
import org.junit.jupiter.api.Test;

/** Verifies the pre-release single-user PostgreSQL baseline is cleanly separated by responsibility. */
class FlywayBaselineStructureTest {
  @Test
  void migrationSetStaysCanonicalAndResponsibilitySeparated() throws IOException {
    assertEquals(
        FlywayMigrationContract.canonicalMigrationNames(),
        FlywayMigrationContract.discoverMigrationNames());

    String v1 = read("V1__project_story_and_planning.sql");
    String v2 = read("V2__generation_and_media.sql");
    String v3 = read("V3__narration_and_artifacts.sql");
    String v4 = read("V4__catalog_generation_and_render_snapshots.sql");
    String v5 = read("V5__database_logic_and_triggers.sql");
    String v6 = read("V6__indexes.sql");
    String v7 = read("V7__seed_catalog.sql");

    for (String schema : new String[] {v1, v2, v3, v4, v5}) {
      assertFalse(schema.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    }
    assertFalse(v6.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v7.matches("(?is).*\\bCREATE\\s+TABLE\\b.*"));
    assertFalse(v7.matches("(?is).*\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b.*"));
    assertFalse(v7.matches("(?is).*\\bALTER\\s+TABLE\\b.*"));

    // V1 - Project, Story, Characters, Storyboard
    assertTrue(v1.contains("CREATE TABLE projects"));
    assertTrue(v1.contains("CREATE TABLE project_favorites"));
    assertTrue(v1.contains("CREATE TABLE story_versions"));
    assertTrue(v1.contains("CREATE TABLE chapters"));
    assertTrue(v1.contains("CREATE TABLE chapter_creation_idempotency"));
    assertTrue(v1.contains("CREATE TABLE storyboard_revisions"));
    assertTrue(v1.contains("CREATE TABLE characters"));
    assertTrue(v1.contains("CREATE TABLE character_versions"));
    assertTrue(v1.contains("CREATE TABLE scenes"));
    assertTrue(v1.contains("CREATE TABLE visual_beats"));
    assertTrue(v1.contains("CREATE TABLE media_plans"));
    assertTrue(v1.contains("reuse_source_visual_beat_id UUID"));
    assertTrue(v1.contains("ck_visual_beats_visual_direction_json_object"));
    assertTrue(v1.contains("CHECK (production_mode = 'IMAGE_MOTION')"));
    assertFalse(v1.contains("preview_asset_id"));
    assertFalse(v1.contains("estimated_cost"));
    assertFalse(v1.contains("pricing_snapshot_json"));
    assertFalse(v1.contains("pricing_fingerprint"));
    String visualBeats = table(v1, "visual_beats", "visual_beat_characters");
    assertFalse(visualBeats.contains("camera_angle"));
    assertFalse(visualBeats.contains("camera_movement VARCHAR"));
    assertFalse(visualBeats.contains("audio_start_ms BIGINT"));
    assertFalse(v1.contains("HYBRID_LOCAL_I2V"));

    // V2 - Generation and Media
    assertTrue(v2.contains("CREATE TABLE generation_jobs"));
    assertTrue(v2.contains("idempotency_key VARCHAR(512)"));
    assertTrue(v2.contains("analysis_visual_generation_mode VARCHAR(16)"));
    assertTrue(v2.contains("analysis_image_provider VARCHAR(32)"));
    assertTrue(v2.contains("ck_generation_jobs_analysis_preferences_consistent"));
    assertTrue(v2.contains("CREATE TABLE media_assets"));
    assertTrue(v2.contains("CREATE TABLE voice_reference_assets"));
    assertTrue(v2.contains("CREATE TABLE production_beat_media_selections"));
    assertTrue(v2.contains("ADD COLUMN preview_media_asset_id UUID"));
    assertTrue(v2.contains("REFERENCES media_assets(id) ON DELETE SET NULL"));
    assertFalse(v2.contains("STORY_ANALYZE"));
    assertFalse(v2.contains("HYBRID_LOCAL_I2V"));
    assertFalse(v2.contains("PAUSED_COST_LIMIT"));
    assertFalse(v2.contains("billed_to_user_id"));
    assertFalse(v2.contains("monthly_credits"));
    assertFalse(v2.contains("credits_used"));
    assertFalse(v2.contains("actual_cost"));
    assertFalse(v2.contains("billing_currency"));

    // V3 - Narration and Artifacts
    assertTrue(v3.contains("CREATE TABLE narration_requests"));
    assertTrue(v3.contains("speaking_rate NUMERIC(8, 4) NOT NULL"));
    assertTrue(v3.contains("voice_reference_asset_id UUID REFERENCES voice_reference_assets(id)"));
    assertTrue(v3.contains("CREATE TABLE narration_alignments"));
    assertTrue(v3.contains("words_json JSONB NOT NULL"));
    assertTrue(v3.contains("ck_narration_alignments_words_array"));
    assertTrue(v3.contains("CREATE TABLE notifications"));
    assertTrue(v3.contains("CREATE TABLE outbox_events"));
    assertTrue(v3.contains("CREATE TABLE render_manifests"));
    assertTrue(v3.contains("CREATE TABLE final_artifacts"));
    assertFalse(v3.contains("CREATE TABLE short_clip_requests"));

    // V4 - Catalog, Snapshots, Lineage
    assertTrue(v4.contains("CREATE TABLE style_presets"));
    assertTrue(v4.contains("CREATE TABLE voice_catalog"));
    assertTrue(v4.contains("CREATE TABLE media_upload_sessions"));
    assertTrue(v4.contains("CREATE TABLE media_generation_items"));
    assertTrue(v4.contains("CREATE TABLE media_asset_lineage"));
    assertTrue(v4.contains("CREATE TABLE chapter_continuity_plans"));
    assertTrue(v4.contains("CREATE TABLE regeneration_plans"));
    assertTrue(v4.contains("CREATE TABLE project_render_input_snapshots"));
    assertTrue(v4.contains("subtitle_text TEXT NOT NULL DEFAULT ''"));
    assertTrue(v4.contains("subtitle_words_json JSONB"));
    assertTrue(v4.contains("ck_project_render_subtitle_words_array"));
    assertFalse(v4.contains("subtitle_spans_json"));
    assertTrue(v4.contains("media_selection_active BOOLEAN NOT NULL DEFAULT FALSE"));
    assertFalse(v4.contains("estimated_cost"));
    assertFalse(v4.contains("currency VARCHAR(3)"));

    // V5 - Database logic & triggers
    assertTrue(v5.contains("CREATE TRIGGER trg_media_plans_immutable"));
    assertTrue(v5.contains("CREATE TRIGGER trg_generation_jobs_notify_completion"));
    assertTrue(v5.contains("CREATE TRIGGER trg_generation_jobs_events"));
    assertFalse(v5.contains("finalize_quota_reservation_on_job_terminal"));
    assertFalse(v5.contains("trg_generation_jobs_finalize_quota"));
    assertFalse(v5.contains("CHAPTER_RENDER"));

    // V6 - Indexes
    assertTrue(v6.contains("CREATE INDEX idx_projects_status"));
    assertTrue(v6.contains("CREATE UNIQUE INDEX uq_generation_jobs_idempotency_key"));
    assertTrue(v6.contains("CREATE INDEX idx_narration_requests_voice_reference"));
    assertTrue(v6.contains("CREATE INDEX idx_production_beat_media_selection_asset"));
    assertTrue(v6.contains("CREATE INDEX idx_generation_jobs_chapter_workspace_lookup"));
    assertFalse(v6.contains("idx_visual_beats_audio_range"));
    assertFalse(v6.contains("short_clip_requests"));

    // V7 - Seeds
    assertTrue(v7.contains("'VOICESTUDIO'"));
    assertFalse(v7.contains("'VIENEU'"));
    assertTrue(v7.contains("\"supportsSpeakingRate\":true"));
    assertTrue(v7.contains("\"outputFormat\":\"wav\""));
    assertFalse(v7.contains("monthly_credits"));
    assertFalse(v7.contains("payAsYouGo"));

    // Negative architecture assertions across entire migration baseline
    String allSchema = v1 + v2 + v3 + v4 + v5 + v6 + v7;
    assertFalse(allSchema.contains("auth_users"));
    assertFalse(allSchema.contains("SPRING_SESSION"));
    assertFalse(allSchema.contains("desktop_guest_installations"));
    assertFalse(allSchema.contains("desktop_auth_handoffs"));
    assertFalse(allSchema.contains("local_devices"));
    assertFalse(allSchema.contains("local_device_pairing_codes"));
    assertFalse(allSchema.contains("quota_reservations"));
    assertFalse(allSchema.contains("plan_entitlements"));
    assertFalse(allSchema.contains("user_plan_assignments"));
    assertFalse(allSchema.contains("usage_windows"));
    assertFalse(allSchema.contains("owner_id"));
    assertFalse(allSchema.contains("requested_by_user_id"));
    assertFalse(allSchema.contains("account_id"));
    assertFalse(allSchema.contains("project_owner_id"));
    assertFalse(allSchema.contains("reviewed_by_user_id"));
    assertFalse(allSchema.contains("assigned_local_device_id"));
    assertFalse(allSchema.contains("VIENEU"));
    assertFalse(allSchema.contains("finalize_quota_reservation_on_job_terminal"));
    assertFalse(allSchema.contains("trg_generation_jobs_finalize_quota"));
    assertFalse(allSchema.contains("narrativex_uuid_v7"));
    assertFalse(allSchema.contains("CREATE EXTENSION IF NOT EXISTS pgcrypto"));
    assertTrue(allSchema.contains("DEFAULT uuidv7()"));
  }

  @Test
  void storyVersionsDeclareCurrentLifecycleStates() throws IOException {
    String v1 = read("V1__project_story_and_planning.sql");
    String storyVersions =
        v1.substring(
            v1.indexOf("CREATE TABLE story_versions"), v1.indexOf("CREATE TABLE chapters"));

    assertTrue(storyVersions.contains("CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED'))"));
  }

  @Test
  void renderSnapshotChaptersAllowMissingMediaPlan() throws IOException {
    String v4 = read("V4__catalog_generation_and_render_snapshots.sql");
    String chapters =
        v4.substring(
            v4.indexOf("CREATE TABLE project_render_input_chapters"),
            v4.indexOf("CREATE TABLE project_render_input_beats"));

    assertTrue(chapters.contains("media_plan_id UUID REFERENCES media_plans(id)"));
    assertFalse(chapters.contains("media_plan_id UUID NOT NULL REFERENCES media_plans(id)"));
    assertTrue(
        chapters.contains(
            "media_plan_revision INTEGER CHECK (media_plan_revision IS NULL OR media_plan_revision > 0)"));
  }

  private static String read(String name) throws IOException {
    return Files.readString(FlywayMigrationContract.migration(name));
  }

  private static String table(String migration, String table, String nextTable) {
    int start = migration.indexOf("CREATE TABLE " + table);
    int end = migration.indexOf("CREATE TABLE " + nextTable, start);
    assertTrue(start >= 0, "Missing table " + table);
    assertTrue(end > start, "Missing table boundary " + nextTable);
    return migration.substring(start, end);
  }
}
