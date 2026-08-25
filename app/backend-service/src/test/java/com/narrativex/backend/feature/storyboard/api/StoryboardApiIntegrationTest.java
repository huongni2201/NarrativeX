package com.narrativex.backend.feature.storyboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
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
  private static final UUID PROJECT_1 = testUuid(1001);
  private static final UUID PROJECT_2 = testUuid(1002);
  private static final UUID STORY_1 = testUuid(2001);
  private static final UUID STORY_2 = testUuid(2002);
  private static final UUID CHAPTER_1 = testUuid(3001);
  private static final UUID CHAPTER_2 = testUuid(3002);
  private static final UUID REVISION_1 = testUuid(3501);
  private static final UUID REVISION_2 = testUuid(3502);
  private static final UUID REVISION_3 = testUuid(3503);
  private static final UUID SCENE_1 = testUuid(4001);
  private static final UUID BEAT_1 = testUuid(5001);
  private static final UUID PROJECT_ASSET = testUuid(26001);
  private static final UUID MEDIA_PLAN_1 = UUID.fromString("00000000-0000-4000-8000-000000001001");
  private static final UUID MEDIA_PLAN_2 = UUID.fromString("00000000-0000-4000-8000-000000001002");
  private static final UUID RENDER_MANIFEST = testUuid(27001);
  private static final UUID RENDER_JOB = UUID.fromString("00000000-0000-4000-8000-000000000005");
  private static final Long FINAL_ARTIFACT = 28001L;

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
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES ('seed-user-01', 'test@example.com', 'Test User', true) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, description, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) VALUES (?, 'P1001', 'Desc', 'seed-user-01', 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD') ON CONFLICT (id) DO NOTHING",
        PROJECT_1);
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, description, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) VALUES (?, 'P1002', 'Desc', 'seed-user-01', 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD') ON CONFLICT (id) DO NOTHING",
        PROJECT_2);
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status, moderation_decision) VALUES (?, ?, 1, 'Content', 'vi-VN', 'ACTIVE', 'SAFE') ON CONFLICT (id) DO NOTHING",
        STORY_1,
        PROJECT_1);
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status, moderation_decision) VALUES (?, ?, 1, 'Content', 'vi-VN', 'ACTIVE', 'SAFE') ON CONFLICT (id) DO NOTHING",
        STORY_2,
        PROJECT_2);
    jdbcTemplate.update(
        "UPDATE story_versions SET moderation_decision = 'NOT_REQUIRED' WHERE id = ?", STORY_2);
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) VALUES (?, ?, 1, 'Ch 1', 'Text', repeat('a', 64), 'READY', 42000, 100) ON CONFLICT (id) DO NOTHING",
        CHAPTER_1,
        STORY_1);
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) VALUES (?, ?, 1, 'Ch 2', 'Text', repeat('a', 64), 'READY', 42000, 100) ON CONFLICT (id) DO NOTHING",
        CHAPTER_2,
        STORY_2);
    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) VALUES (?, ?, 1, repeat('a', 64), 0, 'DRAFT') ON CONFLICT (id) DO NOTHING",
        REVISION_1,
        CHAPTER_1);
    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) VALUES (?, ?, 1, repeat('a', 64), 0, 'DRAFT') ON CONFLICT (id) DO NOTHING",
        REVISION_2,
        CHAPTER_2);
    jdbcTemplate.update(
        "UPDATE chapters SET current_storyboard_revision_id = ? WHERE id = ?",
        REVISION_1,
        CHAPTER_1);
    jdbcTemplate.update(
        "UPDATE chapters SET current_storyboard_revision_id = ? WHERE id = ?",
        REVISION_2,
        CHAPTER_2);
    jdbcTemplate.update(
        "INSERT INTO scenes (id, chapter_id, storyboard_revision_id, order_index, title, narration, duration_seconds, status) VALUES (?, ?, ?, 1, 'Scene 1', 'Narration', 42, 'APPROVED') ON CONFLICT (id) DO NOTHING",
        SCENE_1,
        CHAPTER_1,
        REVISION_1);
    jdbcTemplate.update(
        "INSERT INTO visual_beats (id, scene_id, order_index, title, visual_intent, review_status, motion_mode, camera_movement, text_start, text_end, audio_start_ms, audio_end_ms) VALUES (?, ?, 1, 'Lanterns at dawn', 'Warm lanterns form a river of light through quiet stone streets.', 'APPROVED', 'BASIC_MOTION', 'PAN', 0, 46, 0, 42000) ON CONFLICT (id) DO NOTHING",
        BEAT_1,
        SCENE_1);
    jdbcTemplate.update(
        "INSERT INTO project_assets (id, project_id, name, asset_type, storage_key, url, mime_type, status, metadata_json) VALUES (?, ?, 'lantern_master.png', 'IMAGE', 'key', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop', 'image/png', 'ACTIVE', '{}'::jsonb) ON CONFLICT (id) DO NOTHING",
        PROJECT_ASSET,
        PROJECT_1);
    jdbcTemplate.update(
        "INSERT INTO media_assets (id, account_id, asset_type, origin, storage_key, original_filename, content_type, size_bytes, sha256, duration_ms, status, checksum_verified_at) VALUES ('00000000-0000-4000-8000-000000004001', 'seed-user-01', 'AUDIO', 'USER_UPLOAD', 'accounts/seed-user-01/uploads/river-intro.wav', 'river-intro.wav', 'audio/wav', 1200000, repeat('3', 64), 60000, 'READY', CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update(
        "INSERT INTO narration_requests (id, project_id, chapter_id, chapter_row_version, source_hash, source_text, voice_id, language, speaking_rate, segmentation_version, request_fingerprint) VALUES ('00000000-0000-4000-8000-000000002001', ?, ?, 0, repeat('a', 64), 'Text', 'voice', 'vi-VN', 1.0, 'v1', repeat('1', 64)) ON CONFLICT (id) DO NOTHING",
        PROJECT_1,
        CHAPTER_1);
    jdbcTemplate.update(
        "INSERT INTO narration_assets (id, narration_request_id, project_asset_id, duration_ms, size_bytes, codec, sample_rate_hz, channels, checksum) VALUES ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000002001', ?, 42000, 840000, 'PCM_S16LE', 48000, 2, repeat('2', 64)) ON CONFLICT (id) DO NOTHING",
        PROJECT_ASSET);
    jdbcTemplate.update(
        "INSERT INTO media_plans (id, chapter_id, chapter_row_version, source_hash, production_mode, revision, narration_characters, image_generate_count, image_edit_count, basic_motion_seconds, planned_i2v_seconds, estimated_cost, created_at) VALUES (?, ?, 0, repeat('a', 64), 'IMAGE_MOTION', 1, 100, 1, 0, 10, 0, 0.1, CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING",
        MEDIA_PLAN_1,
        CHAPTER_1);
    jdbcTemplate.update(
        "INSERT INTO render_manifests (id, project_id, chapter_id, media_plan_id, chapter_row_version, source_hash, render_fingerprint, manifest_json) VALUES (?, ?, ?, ?, 0, repeat('a', 64), repeat('6', 64), '{}'::jsonb) ON CONFLICT (id) DO NOTHING",
        RENDER_MANIFEST,
        PROJECT_1,
        CHAPTER_1,
        MEDIA_PLAN_1);
    jdbcTemplate.update(
        "INSERT INTO generation_jobs (id, job_id, project_id, chapter_id, job_type, status, resource_class, progress, requested_by_user_id, billed_to_user_id) VALUES (?, ?, ?, ?, 'RENDER_PROJECT', 'COMPLETED', 'GPU_HEAVY', 100, 'seed-user-01', 'seed-user-01') ON CONFLICT (id) DO NOTHING",
        RENDER_JOB,
        RENDER_JOB,
        PROJECT_1,
        CHAPTER_1);
    jdbcTemplate.update(
        "INSERT INTO final_artifacts (id, project_id, chapter_id, generation_job_id, render_manifest_id, artifact_type, render_fingerprint, storage_key, storage_provider, external_file_id, mime_type, size_bytes, checksum_sha256, duration_ms, width, height, fps, status) VALUES (?, ?, ?, ?, ?, 'CHAPTER_VIDEO', repeat('6', 64), 'gdrive:drive-file-28001', 'GOOGLE_DRIVE', 'drive-file-28001', 'video/mp4', 24800000, repeat('7', 64), 42000, 1920, 1080, 24.0, 'READY') ON CONFLICT (id) DO NOTHING",
        FINAL_ARTIFACT,
        PROJECT_1,
        CHAPTER_1,
        RENDER_JOB,
        RENDER_MANIFEST);
  }

  @Test
  void storyboardResponseContainsSplitMotionFieldsAndRenderableMetadata() throws Exception {
    mockMvc
        .perform(get("/api/v1/projects/" + PROJECT_1 + "/chapters/" + CHAPTER_1 + "/storyboard"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.chapter.id").value(CHAPTER_1.toString()))
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
    jdbcTemplate.update(
        "UPDATE visual_beats SET preview_asset_id = ? WHERE id = ?", PROJECT_ASSET, BEAT_1);

    mockMvc
        .perform(get("/api/v1/projects/" + PROJECT_1 + "/chapters/" + CHAPTER_1 + "/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.total").value(0))
        .andExpect(jsonPath("$.data.pipeline.audio.status").value("READY"))
        .andExpect(jsonPath("$.data.pipeline.audio.completedAt").isNotEmpty())
        .andExpect(jsonPath("$.data.pipeline.render.status").value("READY"))
        .andExpect(jsonPath("$.data.pipeline.render.completedAt").isNotEmpty())
        .andExpect(
            jsonPath("$.data.pipeline.render.latestJobId")
                .value("00000000-0000-4000-8000-000000000005"))
        .andExpect(jsonPath("$.data.pipeline.render.artifactId").value(FINAL_ARTIFACT.toString()))
        .andExpect(
            jsonPath("$.data.previewScenes[0].previewImageUrl")
                .value(
                    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop"))
        .andExpect(jsonPath("$.data.capabilities.canGenerateVisuals").value(false))
        .andExpect(jsonPath("$.data.capabilities.canGenerateAudio").value(false))
        .andExpect(jsonPath("$.data.capabilities.canRender").value(false));

    mockMvc
        .perform(get("/api/v1/projects/" + PROJECT_2 + "/chapters/" + CHAPTER_2 + "/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.safety").doesNotExist())
        .andExpect(jsonPath("$.data.capabilities.canAnalyze").value(true))
        .andExpect(jsonPath("$.data.pipeline.audio.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.capabilities.canGenerateAudio").value(true))
        .andExpect(jsonPath("$.data.pipeline.render.status").value("NOT_STARTED"));
  }

  @Test
  void chapterWorkspaceIgnoresHistoricalExecutionStateAfterChapterEdit() throws Exception {
    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) "
            + "VALUES (?, ?, 2, repeat('b', 64), 1, 'DRAFT')",
        REVISION_3,
        CHAPTER_1);
    jdbcTemplate.update(
        "INSERT INTO media_plans (id, chapter_id, chapter_row_version, source_hash, production_mode, revision, "
            + "narration_characters, image_generate_count, image_edit_count, basic_motion_seconds, planned_i2v_seconds, "
            + "estimated_cost, storyboard_revision_id, created_at) "
            + "VALUES (?, ?, 1, repeat('b', 64), 'IMAGE_MOTION', 2, "
            + "100, 3, 0, 10, 0, 0.1, ?, CURRENT_TIMESTAMP)",
        MEDIA_PLAN_2,
        CHAPTER_1,
        REVISION_3);
    jdbcTemplate.update(
        "UPDATE chapters SET row_version = 1, source_hash = repeat('b', 64), current_storyboard_revision_id = ? "
            + "WHERE id = ?",
        REVISION_3,
        CHAPTER_1);

    jdbcTemplate.update(
        "INSERT INTO generation_jobs (id, job_id, project_id, chapter_id, chapter_row_version, source_hash, "
            + "storyboard_revision_id, job_type, status, resource_class, progress, requested_by_user_id, billed_to_user_id) "
            + "VALUES (?, ?, ?, ?, 0, repeat('a', 64), ?, "
            + "'CHAPTER_ANALYZE', 'RUNNING', 'PROVIDER_INTERACTIVE', 5, 'seed-user-01', 'seed-user-01')",
        testUuid(6009),
        testUuid(6009),
        PROJECT_1,
        CHAPTER_1,
        REVISION_1);
    jdbcTemplate.update(
        "INSERT INTO generation_jobs (id, job_id, project_id, chapter_id, chapter_row_version, source_hash, "
            + "storyboard_revision_id, job_type, status, resource_class, progress, requested_by_user_id, billed_to_user_id) "
            + "VALUES (?, ?, ?, ?, 0, repeat('a', 64), ?, "
            + "'IMAGE_GENERATE', 'FAILED', 'PROVIDER_INTERACTIVE', 100, 'seed-user-01', 'seed-user-01')",
        testUuid(6010),
        testUuid(6010),
        PROJECT_1,
        CHAPTER_1,
        REVISION_1);
    for (int legacyId = 6011; legacyId <= 6013; legacyId++) {
      UUID id = testUuid(legacyId);
      jdbcTemplate.update(
          "INSERT INTO generation_jobs (id, job_id, project_id, chapter_id, chapter_row_version, source_hash, "
              + "storyboard_revision_id, media_plan_id, media_plan_revision, production_mode, job_type, status, "
              + "resource_class, progress, requested_by_user_id, billed_to_user_id) "
              + "VALUES (?, ?, ?, ?, 1, repeat('b', 64), ?, "
              + "?, 2, 'IMAGE_MOTION', 'IMAGE_GENERATE', 'COMPLETED', "
              + "'PROVIDER_INTERACTIVE', 100, 'seed-user-01', 'seed-user-01')",
          id,
          id,
          PROJECT_1,
          CHAPTER_1,
          REVISION_3,
          MEDIA_PLAN_2);
    }
    jdbcTemplate.update(
        "INSERT INTO chapter_media_heads (chapter_id, generation_job_id) VALUES (?, ?) "
            + "ON CONFLICT (chapter_id) DO UPDATE SET generation_job_id = EXCLUDED.generation_job_id",
        CHAPTER_1,
        testUuid(6013));

    mockMvc
        .perform(get("/api/v1/projects/" + PROJECT_1 + "/chapters/" + CHAPTER_1 + "/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.pipeline.analysis.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.capabilities.canAnalyze").value(true))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.status").value("COMPLETED"))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.total").value(3))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.completed").value(3))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.failed").value(0))
        .andExpect(jsonPath("$.data.pipeline.audio.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.pipeline.render.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.pipeline.sourceOutdated").value(false));
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
        .andExpect(jsonPath("$.data.length()").value(21))
        .andExpect(jsonPath("$.data[0].language").value("vi-VN"));

    mockMvc
        .perform(get("/api/v1/assets?type=AUDIO"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].status").value("READY"))
        .andExpect(jsonPath("$.data.items[0].originalFilename").value("river-intro.wav"));

    mockMvc
        .perform(get("/api/v1/artifacts/" + FINAL_ARTIFACT))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("READY"))
        .andExpect(jsonPath("$.data.previewAvailable").value(true))
        .andExpect(
            jsonPath("$.data.previewUrl").value("/api/v1/artifacts/" + FINAL_ARTIFACT + "/content"))
        .andExpect(jsonPath("$.data.downloadAvailable").value(true))
        .andExpect(
            jsonPath("$.data.downloadUrl")
                .value("/api/v1/artifacts/" + FINAL_ARTIFACT + "/download"))
        .andExpect(jsonPath("$.data.externalFileId").doesNotExist())
        .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
        .andExpect(jsonPath("$.data.accessToken").doesNotExist());

    mockMvc
        .perform(get("/api/v1/artifacts/by-job/00000000-0000-4000-8000-000000000005"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value(FINAL_ARTIFACT.toString()))
        .andExpect(jsonPath("$.data.projectId").value(PROJECT_1.toString()))
        .andExpect(jsonPath("$.data.chapterId").value(CHAPTER_1.toString()))
        .andExpect(jsonPath("$.data.artifactType").value("CHAPTER_VIDEO"))
        .andExpect(jsonPath("$.data.mimeType").value("video/mp4"))
        .andExpect(jsonPath("$.data.durationMs").value(42000))
        .andExpect(jsonPath("$.data.width").value(1920))
        .andExpect(jsonPath("$.data.height").value(1080))
        .andExpect(jsonPath("$.data.status").value("READY"));
  }

  private static UUID testUuid(long suffix) {
    return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", suffix));
  }
}
