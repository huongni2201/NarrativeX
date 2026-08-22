package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotMapper;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class MyBatisChapterAnalysisSnapshotRepositoryIntegrationTest
    extends PostgreSqlIntegrationTestSupport {
  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private ChapterAnalysisSnapshotMapper mapper;

  @Test
  void returnsSnapshotOnlyForTheRequestedOwnedProjectScope() {
    long chapterId = insertChapter("owner-a");
    long projectId =
        jdbcTemplate.queryForObject(
            "SELECT sv.project_id FROM chapters c JOIN story_versions sv ON sv.id = c.story_version_id WHERE c.id = ?",
            Long.class,
            chapterId);
    var repository = new MyBatisChapterAnalysisSnapshotRepository(mapper);

    ChapterAnalysisSource snapshot =
        repository.requireOwnedByProject(projectId, chapterId, "owner-a");

    assertEquals(chapterId, snapshot.chapterId());
    assertEquals("source", snapshot.sourceText());
    assertThrows(
        ResourceNotFoundException.class,
        () -> repository.requireOwnedByProject(projectId, chapterId, "owner-b"));
    assertThrows(
        ResourceNotFoundException.class,
        () -> repository.requireOwnedByProject(projectId + 1, chapterId, "owner-a"));
  }

  private long insertChapter(String ownerId) {
    String suffix = UUID.randomUUID().toString();
    long projectId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO projects
              (name, owner_id, status, source_language, narration_language, metadata_language,
               image_aspect_ratio, image_quality_tier)
            VALUES (?, ?, 'DRAFT', 'en-US', 'en-US', 'en-US', 'RATIO_16_9', 'STANDARD')
            RETURNING id
            """,
            Long.class,
            "Analysis scope " + suffix,
            ownerId);
    long storyVersionId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO story_versions
              (project_id, version_number, content, source_language, status, moderation_decision)
            VALUES (?, 1, 'story', 'en-US', 'DRAFT', 'PENDING')
            RETURNING id
            """,
            Long.class,
            projectId);
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO chapters
          (story_version_id, order_index, title, source_text, source_hash, status)
        VALUES (?, 0, 'Chapter', 'source', ?, 'DRAFT')
        RETURNING id
        """,
        Long.class,
        storyVersionId,
        SOURCE_HASH);
  }
}
