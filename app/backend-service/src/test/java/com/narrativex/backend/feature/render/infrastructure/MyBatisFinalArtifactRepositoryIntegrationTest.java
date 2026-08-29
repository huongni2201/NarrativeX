package com.narrativex.backend.feature.render.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactRepository;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class MyBatisFinalArtifactRepositoryIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final UUID PROJECT_ID = UUID.fromString("00000000-0000-4000-8000-000000009601");
  private static final UUID STORY_VERSION_ID =
      UUID.fromString("00000000-0000-4000-8000-000000009701");
  private static final UUID CHAPTER_ID = UUID.fromString("00000000-0000-4000-8000-000000009801");
  private static final String JOB_ID = "00000000-0000-4000-8000-000000009901";
  private static final UUID GENERATION_JOB_ID = UUID.fromString(JOB_ID);
  private static final Long ARTIFACT_ID = 9911L;
  private static final Long ARCHIVED_ARTIFACT_ID = 9912L;

  @Autowired private FinalArtifactRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void seedArtifacts() {
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES"
            + " ('artifact-owner', 'artifact-owner@example.com', 'Artifact Owner', true) ON"
            + " CONFLICT (id) DO NOTHING");
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, owner_id, status, source_language, narration_language,"
            + " metadata_language, image_aspect_ratio, image_quality_tier) VALUES (?, 'Artifact"
            + " project', 'artifact-owner', 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9',"
            + " 'STANDARD') ON CONFLICT (id) DO NOTHING",
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language,"
            + " status) VALUES (?, ?, 1, 'Content', 'vi-VN', 'ACTIVE')"
            + " ON CONFLICT (id) DO NOTHING",
        STORY_VERSION_ID,
        PROJECT_ID);
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash)"
            + " VALUES (?, ?, 0, 'Chapter', 'Text', repeat('a', 64)) ON CONFLICT (id) DO"
            + " NOTHING",
        CHAPTER_ID,
        STORY_VERSION_ID);
    jdbcTemplate.update(
        "INSERT INTO generation_jobs (id, job_id, project_id, chapter_id, job_type, status,"
            + " resource_class, progress, requested_by_user_id, billed_to_user_id) VALUES (?, ?, ?, ?,"
            + " 'RENDER_PROJECT', 'COMPLETED', 'CPU_RENDER',"
            + " 100, 'artifact-owner', 'artifact-owner') ON CONFLICT (id) DO NOTHING",
        GENERATION_JOB_ID,
        UUID.fromString(JOB_ID),
        PROJECT_ID,
        CHAPTER_ID);
    jdbcTemplate.update(
        "INSERT INTO final_artifacts (id, project_id, chapter_id, generation_job_id, artifact_type,"
            + " render_fingerprint, storage_key, mime_type,"
            + " size_bytes, status) VALUES (?, ?, ?, ?, 'CHAPTER_VIDEO', repeat('d',"
            + " 64), 'artifact/repository.mp4', 'video/mp4',"
            + " 10, 'READY') ON CONFLICT (id) DO NOTHING",
        ARTIFACT_ID,
        PROJECT_ID,
        CHAPTER_ID,
        GENERATION_JOB_ID);
    jdbcTemplate.update(
        "INSERT INTO final_artifacts (id, project_id, chapter_id, generation_job_id, artifact_type,"
            + " render_fingerprint, storage_key, mime_type,"
            + " size_bytes, status) VALUES (?, ?, ?, NULL, 'CHAPTER_VIDEO', repeat('e',"
            + " 64), 'artifact/archived.mp4', 'video/mp4', 10,"
            + " 'ARCHIVED') ON CONFLICT (id) DO NOTHING",
        ARCHIVED_ARTIFACT_ID,
        PROJECT_ID,
        CHAPTER_ID);
  }

  @Test
  void returnsReadyArtifactOnlyForItsOwner() {
    assertThat(repository.findOwned(ARTIFACT_ID, "artifact-owner").status()).isEqualTo("READY");
    assertThatThrownBy(() -> repository.findOwned(ARTIFACT_ID, "wrong-owner"))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void doesNotReturnArchivedArtifactByJob() {
    assertThat(repository.findByGenerationJobId(JOB_ID))
        .isPresent()
        .get()
        .extracting("id")
        .isEqualTo(ARTIFACT_ID);
  }
}
