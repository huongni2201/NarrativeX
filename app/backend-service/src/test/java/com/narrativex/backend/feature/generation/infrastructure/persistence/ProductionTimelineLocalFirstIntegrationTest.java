package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineMapper;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProductionTimelineLocalFirstIntegrationTest {
  private static final String OWNER = "local-first-owner";
  private static final UUID PROJECT_ID = uuid(1);
  private static final UUID STORY_ID = uuid(2);
  private static final UUID CHAPTER_ID = uuid(3);
  private static final UUID REVISION_ID = uuid(4);
  private static final UUID SCENE_ID = uuid(5);
  private static final UUID BEAT_A = uuid(6);
  private static final UUID BEAT_B = uuid(7);
  private static final UUID PREVIEW_A = uuid(8);
  private static final UUID PREVIEW_B = uuid(9);
  private static final UUID OVERRIDE = uuid(10);
  private static final UUID AUDIO_PROJECT_ASSET = uuid(11);
  private static final UUID NARRATION_REQUEST = uuid(12);
  private static final UUID NARRATION_ASSET = uuid(13);

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_local_first_timeline_test")
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
    registry.add("spring.session.jdbc.initialize-schema", () -> "never");
  }

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private ProductionTimelineMapper mapper;

  @BeforeEach
  void seed() {
    seedProjectGraph();
    seedMedia();
    seedVisualBeats();
    seedNarration();
    clearOverride(BEAT_A);
    clearOverride(BEAT_B);
  }

  @Test
  void returnsPreviewMediaWithoutMediaPlan() {
    var chapters = mapper.findChapters(PROJECT_ID, OWNER);
    var beats = mapper.findBeats(PROJECT_ID, OWNER);

    assertThat(chapters)
        .singleElement()
        .satisfies(
            chapter -> {
              assertThat(chapter.getMediaPlanId()).isNull();
              assertThat(chapter.getMediaPlanRevision()).isNull();
              assertThat(chapter.getBeatCount()).isEqualTo(2);
              assertThat(chapter.getReadyBeatCount()).isEqualTo(2);
            });
    assertThat(beats).hasSize(2);
    assertThat(beats.get(0).getMediaAssetId()).isEqualTo(PREVIEW_A);
    assertThat(beats.get(0).getCameraMovement()).isEqualTo("PAN");
    assertThat(beats.get(0).getTextStart()).isZero();
    assertThat(beats.get(0).getTextEnd()).isEqualTo(10);
    assertThat(beats.get(0).isMediaSelectionActive()).isFalse();
    assertThat(beats.get(1).getMediaAssetId()).isEqualTo(PREVIEW_B);
  }

  @Test
  void manualOverrideWinsOverPreview() {
    selectOverride(BEAT_A, OVERRIDE, 500L);

    var overridden = mapper.findBeats(PROJECT_ID, OWNER).get(0);

    assertThat(overridden.getMediaAssetId()).isEqualTo(OVERRIDE);
    assertThat(overridden.isMediaSelectionActive()).isTrue();
    assertThat(overridden.getFitMode()).isEqualTo("TRIM");
    assertThat(overridden.getTrimStartMs()).isEqualTo(500L);
  }

  @Test
  void resetFallsBackToPreview() {
    selectOverride(BEAT_A, OVERRIDE, 500L);
    clearOverride(BEAT_A);

    var reset = mapper.findBeats(PROJECT_ID, OWNER).get(0);

    assertThat(reset.getMediaAssetId()).isEqualTo(PREVIEW_A);
    assertThat(reset.isMediaSelectionActive()).isFalse();
    assertThat(reset.getFitMode()).isEqualTo("TRIM");
    assertThat(reset.getTrimStartMs()).isZero();
  }

  private void seedProjectGraph() {
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES (?, ?, 'Local First', true) ON CONFLICT (id) DO NOTHING",
        OWNER,
        OWNER + "@example.com");
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, description, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) VALUES (?, 'Local first', '', ?, 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD') ON CONFLICT (id) DO NOTHING",
        PROJECT_ID,
        OWNER);
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status) VALUES (?, ?, 1, 'Story', 'vi-VN', 'ACTIVE') ON CONFLICT (id) DO NOTHING",
        STORY_ID,
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) VALUES (?, ?, 0, 'Chapter 1', 'Text', repeat('a', 64), 'READY', 10000, 100) ON CONFLICT (id) DO NOTHING",
        CHAPTER_ID,
        STORY_ID);
    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) VALUES (?, ?, 1, repeat('a', 64), 0, 'DRAFT') ON CONFLICT (id) DO NOTHING",
        REVISION_ID,
        CHAPTER_ID);
    jdbcTemplate.update(
        "UPDATE chapters SET current_storyboard_revision_id = ? WHERE id = ?",
        REVISION_ID,
        CHAPTER_ID);
    jdbcTemplate.update(
        "INSERT INTO scenes (id, chapter_id, storyboard_revision_id, order_index, title, narration, duration_seconds, status) VALUES (?, ?, ?, 0, 'Scene', 'Narration', 10, 'APPROVED') ON CONFLICT (id) DO NOTHING",
        SCENE_ID,
        CHAPTER_ID,
        REVISION_ID);
  }

  private void seedMedia() {
    insertMedia(PREVIEW_A, "preview-a.png", "IMAGE", null, 2048L, "1");
    insertMedia(PREVIEW_B, "preview-b.png", "IMAGE", null, 2048L, "2");
    insertMedia(OVERRIDE, "override.mp4", "VIDEO", 12_000L, 4096L, "3");
  }

  private void seedVisualBeats() {
    jdbcTemplate.update(
        "INSERT INTO visual_beats (id, scene_id, order_index, title, visual_intent, visual_direction_json, review_status, motion_mode, text_start, text_end, preview_media_asset_id) VALUES (?, ?, 0, 'Beat A', 'A', '{\"camera_movement\":\"PAN\"}', 'APPROVED', 'BASIC_MOTION', 0, 10, ?) ON CONFLICT (id) DO UPDATE SET preview_media_asset_id = EXCLUDED.preview_media_asset_id",
        BEAT_A,
        SCENE_ID,
        PREVIEW_A);
    jdbcTemplate.update(
        "INSERT INTO visual_beats (id, scene_id, order_index, title, visual_intent, visual_direction_json, review_status, motion_mode, text_start, text_end, preview_media_asset_id) VALUES (?, ?, 1, 'Beat B', 'B', '{\"camera_movement\":\"NONE\"}', 'APPROVED', 'BASIC_MOTION', 10, 20, ?) ON CONFLICT (id) DO UPDATE SET preview_media_asset_id = EXCLUDED.preview_media_asset_id",
        BEAT_B,
        SCENE_ID,
        PREVIEW_B);
  }

  private void seedNarration() {
    jdbcTemplate.update(
        "INSERT INTO project_assets (id, project_id, name, asset_type, storage_key, url, mime_type, status, metadata_json) VALUES (?, ?, 'chapter.wav', 'AUDIO', 'local/audio/chapter.wav', NULL, 'audio/wav', 'ACTIVE', '{}'::jsonb) ON CONFLICT (id) DO NOTHING",
        AUDIO_PROJECT_ASSET,
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO narration_requests (id, project_id, chapter_id, chapter_row_version, source_hash, source_text, voice_id, language, speaking_rate, segmentation_version, request_fingerprint) VALUES (?, ?, ?, 0, repeat('a', 64), 'Text', 'voice', 'vi-VN', 1.0, 'v1', repeat('4', 64)) ON CONFLICT (id) DO NOTHING",
        NARRATION_REQUEST,
        PROJECT_ID,
        CHAPTER_ID);
    jdbcTemplate.update(
        "INSERT INTO narration_assets (id, narration_request_id, project_asset_id, duration_ms, size_bytes, codec, sample_rate_hz, channels, checksum) VALUES (?, ?, ?, 10000, 1000, 'PCM_S16LE', 48000, 2, repeat('5', 64)) ON CONFLICT (id) DO NOTHING",
        NARRATION_ASSET,
        NARRATION_REQUEST,
        AUDIO_PROJECT_ASSET);
  }

  private void selectOverride(UUID visualBeatId, UUID mediaAssetId, long trimStartMs) {
    jdbcTemplate.update(
        "INSERT INTO production_beat_media_selections (project_id, visual_beat_id, media_asset_id, fit_mode, trim_start_ms) VALUES (?, ?, ?, 'TRIM', ?) ON CONFLICT (project_id, visual_beat_id) DO UPDATE SET media_asset_id = EXCLUDED.media_asset_id, fit_mode = EXCLUDED.fit_mode, trim_start_ms = EXCLUDED.trim_start_ms",
        PROJECT_ID,
        visualBeatId,
        mediaAssetId,
        trimStartMs);
  }

  private void clearOverride(UUID visualBeatId) {
    jdbcTemplate.update(
        "DELETE FROM production_beat_media_selections WHERE project_id = ? AND visual_beat_id = ?",
        PROJECT_ID,
        visualBeatId);
  }

  private void insertMedia(
      UUID id,
      String filename,
      String assetType,
      Long durationMs,
      long sizeBytes,
      String checksumSeed) {
    jdbcTemplate.update(
        "INSERT INTO media_assets (id, account_id, project_id, asset_type, origin, storage_key, original_filename, content_type, size_bytes, sha256, duration_ms, status, checksum_verified_at) VALUES (?, ?, ?, ?, 'USER_UPLOAD', NULL, ?, ?, ?, repeat(?, 64), ?, 'READY', CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING",
        id,
        OWNER,
        PROJECT_ID,
        assetType,
        filename,
        "VIDEO".equals(assetType) ? "video/mp4" : "image/png",
        sizeBytes,
        checksumSeed,
        durationMs);
  }

  private static UUID uuid(long value) {
    return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", value));
  }
}
