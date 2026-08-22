package com.narrativex.backend.feature.storyboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class StoryboardApiIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("narrativex_storyboard_api_test")
          .withUsername("narrativex")
          .withPassword("narrativex");

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.data.redis.repositories.enabled", () -> false);
    registry.add("narrativex.security.local-dev-identity-enabled", () -> true);
    registry.add("narrativex.security.local-user-id", () -> "seed-user-01");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUpTestData() {
    jdbcTemplate.update("INSERT INTO auth_users (id, email, display_name, password_hash, enabled) VALUES ('seed-user-01', 'test@example.com', 'Test User', 'pass', true) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO projects (id, name, description, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) VALUES (1001, 'P1001', 'Desc', 'seed-user-01', 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO projects (id, name, description, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) VALUES (1002, 'P1002', 'Desc', 'seed-user-01', 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO story_versions (id, project_id, version_number, content, source_language, status, moderation_decision) VALUES (2001, 1001, 1, 'Content', 'vi-VN', 'ACTIVE', 'SAFE') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO story_versions (id, project_id, version_number, content, source_language, status, moderation_decision) VALUES (2002, 1002, 1, 'Content', 'vi-VN', 'ACTIVE', 'SAFE') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) VALUES (3001, 2001, 1, 'Ch 1', 'Text', repeat('a', 64), 'READY', 42000, 100) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) VALUES (3002, 2002, 1, 'Ch 2', 'Text', repeat('a', 64), 'READY', 42000, 100) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) VALUES (3501, 3001, 1, repeat('a', 64), 0, 'DRAFT') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) VALUES (3502, 3002, 1, repeat('a', 64), 0, 'DRAFT') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("UPDATE chapters SET current_storyboard_revision_id = 3501 WHERE id = 3001");
    jdbcTemplate.update("UPDATE chapters SET current_storyboard_revision_id = 3502 WHERE id = 3002");
    jdbcTemplate.update("INSERT INTO scenes (id, chapter_id, storyboard_revision_id, order_index, title, narration, duration_seconds, status) VALUES (4001, 3001, 3501, 1, 'Scene 1', 'Narration', 42, 'APPROVED') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO visual_beats (id, scene_id, order_index, title, visual_intent, review_status, motion_mode, camera_movement, text_start, text_end, audio_start_ms, audio_end_ms) VALUES (5001, 4001, 1, 'Lanterns at dawn', 'Warm lanterns form a river of light through quiet stone streets.', 'APPROVED', 'BASIC_MOTION', 'PAN', 0, 46, 0, 42000) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO project_assets (id, project_id, name, asset_type, storage_key, url, mime_type, status, metadata_json) VALUES (26001, 1001, 'lantern_master.png', 'IMAGE', 'key', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop', 'image/png', 'ACTIVE', '{}'::jsonb) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO media_assets (id, account_id, asset_type, origin, storage_key, original_filename, content_type, size_bytes, sha256, duration_ms, status, checksum_verified_at) VALUES ('00000000-0000-4000-8000-000000004001', 'seed-user-01', 'AUDIO', 'USER_UPLOAD', 'accounts/seed-user-01/uploads/river-intro.wav', 'river-intro.wav', 'audio/wav', 1200000, repeat('3', 64), 60000, 'READY', CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO narration_requests (id, project_id, chapter_id, chapter_row_version, source_hash, source_text, voice_id, language, speaking_rate, segmentation_version, request_fingerprint) VALUES ('00000000-0000-4000-8000-000000002001', 1001, 3001, 0, repeat('a', 64), 'Text', 'voice', 'vi-VN', 1.0, 'v1', repeat('1', 64)) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO narration_assets (id, narration_request_id, project_asset_id, duration_ms, size_bytes, codec, sample_rate_hz, channels, checksum) VALUES ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000002001', 26001, 42000, 840000, 'PCM_S16LE', 48000, 2, repeat('2', 64)) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO media_plans (id, chapter_id, chapter_row_version, source_hash, production_mode, revision, narration_characters, image_generate_count, image_edit_count, basic_motion_seconds, planned_i2v_seconds, estimated_cost, created_at) VALUES ('00000000-0000-4000-8000-000000001001', 3001, 0, repeat('a', 64), 'IMAGE_MOTION', 1, 100, 1, 0, 10, 0, 0.1, CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO render_manifests (id, project_id, chapter_id, media_plan_id, chapter_row_version, source_hash, render_fingerprint, manifest_json) VALUES (27001, 1001, 3001, '00000000-0000-4000-8000-000000001001', 0, repeat('a', 64), repeat('6', 64), '{}'::jsonb) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO generation_jobs (id, job_id, project_id, chapter_id, job_type, status, resource_class, progress, requested_by_user_id, billed_to_user_id) VALUES (6005, '00000000-0000-4000-8000-000000000005', 1001, 3001, 'RENDER_PROJECT', 'COMPLETED', 'GPU_HEAVY', 100, 'seed-user-01', 'seed-user-01') ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update("INSERT INTO final_artifacts (id, project_id, chapter_id, generation_job_id, render_manifest_id, artifact_type, render_fingerprint, storage_key, mime_type, size_bytes, checksum_sha256, duration_ms, width, height, fps, status) VALUES (28001, 1001, 3001, 6005, 27001, 'CHAPTER_VIDEO', repeat('6', 64), 'key', 'video/mp4', 24800000, repeat('7', 64), 42000, 1920, 1080, 24.0, 'READY') ON CONFLICT (id) DO NOTHING");
  }

  @Test
  void storyboardResponseContainsSplitMotionFieldsAndRenderableMetadata() throws Exception {
    mockMvc
        .perform(get("/api/v1/projects/1001/chapters/3001/storyboard"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.chapter.id").value(3001))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].title").value("Lanterns at dawn"))
        .andExpect(
            jsonPath("$.data.scenes[0].visualBeats[0].visualIntent")
                .value("Warm lanterns form a river of light through quiet stone streets."))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].motionMode").value("BASIC_MOTION"))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].cameraMovement").value("PAN"))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].reviewStatus").value("APPROVED"))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].rowVersion").isNumber());
  }

  @Test
  void chapterWorkspaceProjectsNarrationAndRenderStateFromDurableRows() throws Exception {
    jdbcTemplate.update("UPDATE visual_beats SET preview_asset_id = ? WHERE id = ?", 26001, 5001);

    mockMvc
        .perform(get("/api/v1/projects/1001/chapters/3001/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.total").value(0))
        .andExpect(jsonPath("$.data.pipeline.audio.status").value("READY"))
        .andExpect(jsonPath("$.data.pipeline.audio.completedAt").isNotEmpty())
        .andExpect(jsonPath("$.data.pipeline.render.status").value("COMPLETED"))
        .andExpect(jsonPath("$.data.pipeline.render.completedAt").isNotEmpty())
        .andExpect(
            jsonPath("$.data.previewScenes[0].previewImageUrl")
                .value("https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop"))
        .andExpect(jsonPath("$.data.capabilities.canGenerateVisuals").value(false))
        .andExpect(jsonPath("$.data.capabilities.canGenerateAudio").value(false))
        .andExpect(jsonPath("$.data.capabilities.canRender").value(false));

    mockMvc
        .perform(get("/api/v1/projects/1002/chapters/3002/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.pipeline.audio.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.pipeline.render.status").value("NOT_STARTED"));
  }

  @Test
  void catalogsAndArtifactMetadataComeFromPostgres() throws Exception {
    mockMvc
        .perform(get("/api/v1/style-presets?category=VISUAL_STYLE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("Cinematic Warmth"))
        .andExpect(jsonPath("$.data[0].tags[0]").value("cinematic"));

    mockMvc
        .perform(get("/api/v1/voices?language=vi-VN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(19))
        .andExpect(jsonPath("$.data[0].language").value("vi-VN"));

    mockMvc
        .perform(get("/api/v1/assets?type=AUDIO"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].status").value("READY"))
        .andExpect(jsonPath("$.data.items[0].originalFilename").value("river-intro.wav"));

    mockMvc
        .perform(get("/api/v1/artifacts/28001/download"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("READY"))
        .andExpect(jsonPath("$.data.downloadAvailable").value(false))
        .andExpect(jsonPath("$.data.downloadUrl").doesNotExist());
  }
}
