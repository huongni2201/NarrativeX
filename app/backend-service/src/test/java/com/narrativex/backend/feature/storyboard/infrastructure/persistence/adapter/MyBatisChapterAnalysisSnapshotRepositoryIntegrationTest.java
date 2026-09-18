package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotMapper;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@ActiveProfiles("test")
class MyBatisChapterAnalysisSnapshotRepositoryIntegrationTest
    extends PostgreSqlIntegrationTestSupport {
  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private ChapterAnalysisSnapshotMapper mapper;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private StoryboardRevisionAccess storyboardRevisionAccess;

  @Test
  void chapterAdvisoryLockMapsItsIntegerSentinel() {
    UUID chapterId = insertChapter();
    new TransactionTemplate(transactionManager)
        .executeWithoutResult(status -> storyboardRevisionAccess.lockChapter(chapterId));
  }

  @Test
  void returnsSnapshotOnlyForTheRequestedProjectScope() {
    UUID chapterId = insertChapter();
    UUID projectId =
        jdbcTemplate.queryForObject(
            "SELECT sv.project_id FROM chapters c JOIN story_versions sv ON sv.id = c.story_version_id WHERE c.id = ?",
            UUID.class,
            chapterId);
    var repository = new MyBatisChapterAnalysisSnapshotRepository(mapper);

    ChapterAnalysisSource snapshot = repository.requireByProject(projectId, chapterId);

    assertEquals(chapterId, snapshot.chapterId());
    assertEquals("source", snapshot.sourceText());
    assertThrows(
        ResourceNotFoundException.class,
        () -> repository.requireByProject(UuidV7.random(), chapterId));
  }

  private UUID insertChapter() {
    String suffix = UuidV7.random().toString();
    UUID projectId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO projects
              (name, status, source_language, narration_language, metadata_language,
               image_aspect_ratio)
            VALUES (?, 'DRAFT', 'en-US', 'en-US', 'en-US', 'RATIO_16_9')
            RETURNING id
            """,
            UUID.class,
            "Analysis scope " + suffix);
    UUID storyVersionId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO story_versions
              (project_id, version_number, content, source_language, status)
            VALUES (?, 1, 'story', 'en-US', 'DRAFT')
            RETURNING id
            """,
            UUID.class,
            projectId);
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO chapters
          (story_version_id, order_index, title, source_text, source_hash, status)
        VALUES (?, 0, 'Chapter', 'source', ?, 'DRAFT')
        RETURNING id
        """,
        UUID.class,
        storyVersionId,
        SOURCE_HASH);
  }
}
