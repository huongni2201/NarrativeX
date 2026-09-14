package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineChapterRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProjectRenderInputSnapshotMapper;
import java.util.List;
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
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class NarrationAlignmentPostgreSqlIntegrationTest {
  private static final String OWNER = "alignment-owner";
  private static final String SOURCE_HASH = "a".repeat(64);
  private static final UUID PROJECT_ID = uuid(1);
  private static final UUID STORY_ID = uuid(2);
  private static final UUID CHAPTER_ID = uuid(3);
  private static final UUID AUDIO_PROJECT_ASSET_ID = uuid(4);
  private static final UUID NARRATION_REQUEST_ID = uuid(5);
  private static final UUID NARRATION_ASSET_ID = uuid(6);
  private static final UUID ALIGNMENT_ID = uuid(7);
  private static final UUID GENERATION_JOB_ID = uuid(8);
  private static final UUID LOCAL_DEVICE_ID = uuid(9);

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_alignment_contract_test")
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
  @Autowired private ProductionTimelineMapper productionTimelineMapper;
  @Autowired private ProjectRenderInputSnapshotMapper snapshotMapper;

  @BeforeEach
  void seed() {
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES (?, ?, 'Alignment', true)",
        OWNER,
        OWNER + "@example.com");
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, description, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) VALUES (?, 'Alignment', '', ?, 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD')",
        PROJECT_ID,
        OWNER);
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status) VALUES (?, ?, 1, 'Xin chào', 'vi-VN', 'ACTIVE')",
        STORY_ID,
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) VALUES (?, ?, 0, 'Chapter', 'Xin chào', ?, 'READY', 1000, 100)",
        CHAPTER_ID,
        STORY_ID,
        SOURCE_HASH);
    jdbcTemplate.update(
        "INSERT INTO project_assets (id, project_id, name, asset_type, storage_key, url, mime_type, status, metadata_json) VALUES (?, ?, 'chapter.wav', 'AUDIO', 'local/audio/chapter.wav', NULL, 'audio/wav', 'ACTIVE', '{}'::jsonb)",
        AUDIO_PROJECT_ASSET_ID,
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO narration_requests (id, project_id, chapter_id, chapter_row_version, source_hash, source_text, voice_id, language, speaking_rate, segmentation_version, request_fingerprint) VALUES (?, ?, ?, 0, ?, 'Xin chào', 'voice', 'vi-VN', 1.0, 'v1', ?)",
        NARRATION_REQUEST_ID,
        PROJECT_ID,
        CHAPTER_ID,
        SOURCE_HASH,
        "b".repeat(64));
    jdbcTemplate.update(
        "INSERT INTO narration_assets (id, narration_request_id, project_asset_id, duration_ms, size_bytes, codec, sample_rate_hz, channels, checksum) VALUES (?, ?, ?, 1000, 1000, 'PCM_S16LE', 48000, 2, ?)",
        NARRATION_ASSET_ID,
        NARRATION_REQUEST_ID,
        AUDIO_PROJECT_ASSET_ID,
        "c".repeat(64));
    jdbcTemplate.update(
        "INSERT INTO narration_alignments (id, narration_asset_id, source_hash, alignment_version, words_json) VALUES (?, ?, ?, 'whisperx-forced-v1', CAST(? AS jsonb))",
        ALIGNMENT_ID,
        NARRATION_ASSET_ID,
        SOURCE_HASH,
        wordsJson());
    jdbcTemplate.update(
        "INSERT INTO generation_jobs (id, job_id, project_id, job_type, status, resource_class, progress, requested_by_user_id, story_version_id) VALUES (?, ?, ?, 'RENDER_PROJECT', 'QUEUED', 'CPU_RENDER', 0, ?, ?)",
        GENERATION_JOB_ID,
        GENERATION_JOB_ID,
        PROJECT_ID,
        OWNER,
        STORY_ID);
    jdbcTemplate.update(
        "INSERT INTO local_devices (id, user_id, name, platform, agent_version, token_hash, last_seen_at) VALUES (?, ?, 'CI Desktop', 'test', '1.0', ?, CURRENT_TIMESTAMP)",
        LOCAL_DEVICE_ID,
        OWNER,
        "d".repeat(64));
  }

  @Test
  void workerAlignmentFlowsThroughTimelineIntoRenderSnapshot() {
    ProductionTimelineChapterRow row =
        productionTimelineMapper.findChapters(PROJECT_ID, OWNER).getFirst();

    assertThat(row.getNarrationAlignmentId()).isEqualTo(ALIGNMENT_ID);
    assertThat(row.getSubtitleWordsJson()).contains("audioStartMs");

    ProductionTimelineView.Chapter chapter = snapshotChapter(row);
    ProductionTimelineView timeline =
        new ProductionTimelineView(
            PROJECT_ID,
            STORY_ID,
            1_000L,
            row.getAspectRatio(),
            false,
            List.of(chapter),
            List.of());

    assertThat(
            snapshotMapper.insertHeader(
                GENERATION_JOB_ID,
                timeline,
                "1080p",
                "mp4",
                LOCAL_DEVICE_ID,
                1,
                1,
                "{\"schemaVersion\":2}"))
        .isEqualTo(1);
    assertThat(snapshotMapper.insertChapter(GENERATION_JOB_ID, chapter)).isEqualTo(1);

    Integer wordCount =
        jdbcTemplate.queryForObject(
            "SELECT jsonb_array_length(subtitle_words_json) FROM project_render_input_chapters WHERE generation_job_id = ? AND chapter_id = ?",
            Integer.class,
            GENERATION_JOB_ID,
            CHAPTER_ID);
    Integer firstAudioStartMs =
        jdbcTemplate.queryForObject(
            "SELECT (subtitle_words_json -> 0 ->> 'audioStartMs')::integer FROM project_render_input_chapters WHERE generation_job_id = ? AND chapter_id = ?",
            Integer.class,
            GENERATION_JOB_ID,
            CHAPTER_ID);
    UUID persistedAlignmentId =
        jdbcTemplate.queryForObject(
            "SELECT narration_alignment_id FROM project_render_input_chapters WHERE generation_job_id = ? AND chapter_id = ?",
            UUID.class,
            GENERATION_JOB_ID,
            CHAPTER_ID);

    assertThat(wordCount).isEqualTo(2);
    assertThat(firstAudioStartMs).isEqualTo(120);
    assertThat(persistedAlignmentId).isEqualTo(ALIGNMENT_ID);
  }

  private static ProductionTimelineView.Chapter snapshotChapter(ProductionTimelineChapterRow row) {
    return new ProductionTimelineView.Chapter(
        row.getChapterId(),
        row.getOrderIndex(),
        row.getTitle(),
        row.getRowVersion(),
        row.getSourceHash(),
        row.getMediaPlanId(),
        row.getMediaPlanRevision(),
        0L,
        row.getAudioDurationMs(),
        row.getAudioDurationMs(),
        row.getAudioStorageKey(),
        row.getAudioSizeBytes(),
        row.getAudioChecksum(),
        row.getNarrationRequestId(),
        row.getNarrationAssetId(),
        row.getNarrationAlignmentId(),
        row.getSubtitleText(),
        row.getSubtitleWordsJson(),
        row.getBeatCount(),
        row.getReadyBeatCount(),
        false);
  }

  private static String wordsJson() {
    return """
        [
          {"index":0,"textStart":0,"textEnd":3,"audioStartMs":120,"audioEndMs":420,"confidence":0.99},
          {"index":1,"textStart":4,"textEnd":8,"audioStartMs":500,"audioEndMs":880,"confidence":0.98}
        ]
        """;
  }

  private static UUID uuid(long value) {
    return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", value));
  }
}
