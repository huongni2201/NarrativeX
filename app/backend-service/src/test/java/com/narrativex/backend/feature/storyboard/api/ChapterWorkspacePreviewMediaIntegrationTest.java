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
class ChapterWorkspacePreviewMediaIntegrationTest {
  private static final String USER_ID = "workspace-preview-user";
  private static final UUID PROJECT_ID = testUuid(91001);
  private static final UUID STORY_ID = testUuid(91002);
  private static final UUID CHAPTER_ID = testUuid(91003);
  private static final UUID REVISION_ID = testUuid(91004);
  private static final UUID SCENE_ID = testUuid(91005);
  private static final UUID BEAT_ID = testUuid(91006);
  private static final UUID MEDIA_ASSET_ID = testUuid(91007);

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_workspace_preview_test")
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
    registry.add("narrativex.security.local-dev-identity-enabled", () -> true);
    registry.add("narrativex.security.local-user-id", () -> USER_ID);
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUp() {
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES (?, 'workspace-preview@example.com', 'Workspace Preview', true)",
        USER_ID);
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, description, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) "
            + "VALUES (?, 'Workspace preview', '', ?, 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD')",
        PROJECT_ID,
        USER_ID);
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status) VALUES (?, ?, 1, 'Text', 'vi-VN', 'ACTIVE')",
        STORY_ID,
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) "
            + "VALUES (?, ?, 1, 'Chapter', 'Text', repeat('a', 64), 'READY', 1000, 0)",
        CHAPTER_ID,
        STORY_ID);
    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) "
            + "VALUES (?, ?, 1, repeat('a', 64), 0, 'DRAFT')",
        REVISION_ID,
        CHAPTER_ID);
    jdbcTemplate.update(
        "UPDATE chapters SET current_storyboard_revision_id = ? WHERE id = ?",
        REVISION_ID,
        CHAPTER_ID);
    jdbcTemplate.update(
        "INSERT INTO scenes (id, chapter_id, storyboard_revision_id, order_index, title, narration, duration_seconds, status) "
            + "VALUES (?, ?, ?, 1, 'Scene', 'Text', 1, 'DRAFT')",
        SCENE_ID,
        CHAPTER_ID,
        REVISION_ID);
    jdbcTemplate.update(
        "INSERT INTO media_assets (id, account_id, project_id, asset_type, origin, storage_mode, storage_key, original_filename, content_type, size_bytes, sha256, status) "
            + "VALUES (?, ?, ?, 'IMAGE', 'LOCAL_ONLY', 'LOCAL_ONLY', NULL, 'preview.png', 'image/png', 1024, repeat('b', 64), 'READY')",
        MEDIA_ASSET_ID,
        USER_ID,
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO visual_beats (id, scene_id, order_index, title, visual_intent, review_status, preview_media_asset_id) "
            + "VALUES (?, ?, 1, 'Beat', 'Preview media regression', 'DRAFT', ?)",
        BEAT_ID,
        SCENE_ID,
        MEDIA_ASSET_ID);
  }

  @Test
  void workspaceProjectsCanonicalPreviewMediaAssetIdentity() throws Exception {
    mockMvc
        .perform(get("/api/v1/projects/" + PROJECT_ID + "/chapters/" + CHAPTER_ID + "/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.previewScenes[0].visualBeatCount").value(1))
        .andExpect(jsonPath("$.data.previewScenes[0].previewMediaAssetId").value(MEDIA_ASSET_ID.toString()))
        .andExpect(jsonPath("$.data.previewScenes[0].previewImageUrl").doesNotExist());
  }

  private static UUID testUuid(long suffix) {
    return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", suffix));
  }
}
