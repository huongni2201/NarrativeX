package com.narrativex.backend.feature.render.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FinalArtifactControllerIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final Path FINAL_ROOT = createFinalRoot();
  private static final UUID PROJECT_ID = testUuid(9101);
  private static final UUID OTHER_PROJECT_ID = testUuid(9102);
  private static final UUID STORY_VERSION_ID = testUuid(9201);
  private static final UUID OTHER_STORY_VERSION_ID = testUuid(9202);
  private static final UUID CHAPTER_ID = testUuid(9301);
  private static final UUID OTHER_CHAPTER_ID = testUuid(9302);
  private static final UUID READY_JOB_ID = testUuid(9401);
  private static final UUID ARCHIVED_JOB_ID = testUuid(9402);
  private static final UUID READY_JOB_ROW_ID = testUuid(9401);
  private static final UUID ARCHIVED_JOB_ROW_ID = testUuid(9402);
  private static final Long READY_ARTIFACT_ID = 9501L;
  private static final Long ARCHIVED_ARTIFACT_ID = 9502L;
  private static final Long OTHER_ARTIFACT_ID = 9503L;
  private static final UUID UNKNOWN_JOB_ID = testUuid(9599);

  @DynamicPropertySource
  static void finalArtifactProperties(DynamicPropertyRegistry registry) {
    registry.add("narrativex.storage.final-video-mode", () -> "local");
    registry.add("narrativex.storage.final-video-local-dir", FINAL_ROOT::toString);
    registry.add("narrativex.security.local-dev-identity-enabled", () -> true);
    registry.add("narrativex.security.local-user-id", () -> "seed-user-01");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void seedFinalArtifacts() throws Exception {
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES"
            + " ('seed-user-01', 'render-test@example.com', 'Render Test', true) ON"
            + " CONFLICT (id) DO NOTHING");
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES"
            + " ('other-owner', 'other-render@example.com', 'Other Owner', true) ON"
            + " CONFLICT (id) DO NOTHING");
    insertProject(PROJECT_ID, "seed-user-01");
    insertProject(OTHER_PROJECT_ID, "other-owner");
    insertStoryAndChapter(STORY_VERSION_ID, PROJECT_ID, CHAPTER_ID);
    insertStoryAndChapter(OTHER_STORY_VERSION_ID, OTHER_PROJECT_ID, OTHER_CHAPTER_ID);
    insertJob(READY_JOB_ROW_ID, READY_JOB_ID, PROJECT_ID, CHAPTER_ID);
    insertJob(ARCHIVED_JOB_ROW_ID, ARCHIVED_JOB_ID, PROJECT_ID, CHAPTER_ID);
    insertArtifact(
        READY_ARTIFACT_ID, PROJECT_ID, CHAPTER_ID, READY_JOB_ROW_ID, "READY", "artifact-9501.mp4");
    insertArtifact(
        ARCHIVED_ARTIFACT_ID,
        PROJECT_ID,
        CHAPTER_ID,
        ARCHIVED_JOB_ROW_ID,
        "ARCHIVED",
        "artifact-9502.mp4");
    insertArtifact(
        OTHER_ARTIFACT_ID,
        OTHER_PROJECT_ID,
        OTHER_CHAPTER_ID,
        READY_JOB_ROW_ID,
        "READY",
        "artifact-9503.mp4");
    byte[] bytes = new byte[2048];
    IntStream.range(0, bytes.length).forEach(i -> bytes[i] = (byte) (i % 251));
    Files.write(FINAL_ROOT.resolve("artifact-9501.mp4"), bytes);
  }

  @Test
  void completedRenderReturnsReadyArtifactByJob() throws Exception {
    mockMvc.perform(get("/api/v1/artifacts/by-job/" + READY_JOB_ID)).andExpect(status().isOk());
  }

  @Test
  void unknownJobAndWrongOwnerAreNotVisible() throws Exception {
    mockMvc
        .perform(get("/api/v1/artifacts/by-job/" + UNKNOWN_JOB_ID))
        .andExpect(status().isNotFound());
    mockMvc.perform(get("/api/v1/artifacts/" + OTHER_ARTIFACT_ID)).andExpect(status().isNotFound());
  }

  @Test
  void archivedArtifactIsNotReturned() throws Exception {
    mockMvc
        .perform(get("/api/v1/artifacts/" + ARCHIVED_ARTIFACT_ID))
        .andExpect(status().isNotFound());
  }

  @Test
  void rangeAndDispositionSemanticsArePreserved() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/artifacts/" + READY_ARTIFACT_ID + "/download")
                .header(HttpHeaders.RANGE, "bytes=0-1023"))
        .andExpect(status().isPartialContent())
        .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 0-1023/2048"))
        .andExpect(
            header()
                .string(
                    HttpHeaders.CONTENT_DISPOSITION,
                    org.hamcrest.Matchers.containsString("attachment")));

    mockMvc
        .perform(get("/api/v1/artifacts/" + READY_ARTIFACT_ID + "/preview"))
        .andExpect(status().isOk())
        .andExpect(
            header()
                .string(
                    HttpHeaders.CONTENT_DISPOSITION,
                    org.hamcrest.Matchers.containsString("inline")));

    mockMvc
        .perform(
            get("/api/v1/artifacts/" + READY_ARTIFACT_ID + "/preview")
                .header(HttpHeaders.RANGE, "bytes=not-a-range"))
        .andExpect(status().isRequestedRangeNotSatisfiable());
  }

  private void insertProject(UUID id, String ownerId) {
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, description, owner_id, status, source_language,"
            + " narration_language, metadata_language, image_aspect_ratio, image_quality_tier)"
            + " VALUES (?, ?, 'Desc', ?, 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9',"
            + " 'STANDARD') ON CONFLICT (id) DO NOTHING",
        id,
        "Render project " + id,
        ownerId);
  }

  private void insertStoryAndChapter(UUID storyId, UUID projectId, UUID chapterId) {
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language,"
            + " status, moderation_decision) VALUES (?, ?, 1, 'Content', 'vi-VN', 'ACTIVE', 'SAFE')"
            + " ON CONFLICT (id) DO NOTHING",
        storyId,
        projectId);
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash,"
            + " status, estimated_duration_ms, generation_progress) VALUES (?, ?, 0, 'Chapter',"
            + " 'Text', repeat('a', 64), 'READY', 1000, 100) ON CONFLICT (id) DO NOTHING",
        chapterId,
        storyId);
  }

  private void insertJob(UUID id, UUID jobId, UUID projectId, UUID chapterId) {
    jdbcTemplate.update(
        "INSERT INTO generation_jobs (id, job_id, project_id, chapter_id, job_type, status,"
            + " resource_class, progress, requested_by_user_id, billed_to_user_id) VALUES (?, ?, ?,"
            + " ?, 'CHAPTER_RENDER', 'COMPLETED', 'CPU_RENDER', 100, 'seed-user-01',"
            + " 'seed-user-01') ON CONFLICT (id) DO NOTHING",
        id,
        jobId,
        projectId,
        chapterId);
  }

  private void insertArtifact(
      Long id, UUID projectId, UUID chapterId, UUID jobId, String status, String fileName) {
    jdbcTemplate.update(
        "INSERT INTO final_artifacts (id, project_id, chapter_id, generation_job_id, artifact_type,"
            + " render_fingerprint, storage_key, storage_provider, external_file_id, mime_type,"
            + " size_bytes, checksum_sha256, duration_ms, width, height, fps, status) VALUES (?, ?,"
            + " ?, ?, 'CHAPTER_VIDEO', repeat('b', 64), ?, 'LOCAL', ?, 'video/mp4', 2048,"
            + " repeat('c', 64), 1000, 1920, 1080, 24.0, ?) ON CONFLICT (id) DO NOTHING",
        id,
        projectId,
        chapterId,
        jobId,
        "local/" + fileName,
        FINAL_ROOT.resolve(fileName).toString(),
        status);
  }

  private static Path createFinalRoot() {
    try {
      return Files.createTempDirectory("narrativex-final-controller-");
    } catch (Exception exception) {
      throw new ExceptionInInitializerError(exception);
    }
  }

  private static UUID testUuid(long suffix) {
    return UUID.fromString("00000000-0000-4000-8000-" + String.format("%012d", suffix));
  }
}
