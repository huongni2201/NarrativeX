package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@ActiveProfiles("test")
class MyBatisChapterRepositoryIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final String HASH_HELLO =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
  private static final String HASH_UPDATED =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  @Autowired private ChapterRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private TransactionTemplate transactionTemplate;

  @Test
  void contextSelectsExactlyOneMyBatisChapterRepositoryAndRoundTripsUnicodeText() {
    assertInstanceOf(MyBatisChapterRepository.class, repository);
    UUID storyVersionId = insertStoryVersion();
    String sourceText = "Xin chào NarrativeX — \"quote\"\nEnglish line\n🙂";

    Chapter saved =
        repository.saveAndFlush(
            new Chapter(storyVersionId, 2, "Chương Một", sourceText, HASH_HELLO));
    Chapter reloaded = repository.findById(saved.getId()).orElseThrow();

    assertEquals(saved.getId(), reloaded.getId());
    assertEquals(storyVersionId, reloaded.getStoryVersionId());
    assertEquals(sourceText, reloaded.getSourceText());
    assertEquals(HASH_HELLO, reloaded.getSourceHash());
    assertEquals(0L, reloaded.getRowVersion());
    assertNotNull(
        jdbcTemplate.queryForObject(
            "SELECT created_at FROM chapters WHERE id = ?", Object.class, saved.getId()));
    assertEquals(
        0L,
        jdbcTemplate.queryForObject(
            "SELECT row_version FROM chapters WHERE id = ?", Long.class, saved.getId()));
  }

  @Test
  void preservesDeterministicOrderingAndCursorPagination() {
    UUID storyVersionId = insertStoryVersion();
    repository.save(new Chapter(storyVersionId, 2, "Two", "two", HASH_HELLO));
    repository.save(new Chapter(storyVersionId, 0, "Zero", "zero", HASH_HELLO));
    repository.save(new Chapter(storyVersionId, 1, "One", "one", HASH_HELLO));

    List<Chapter> all = repository.findAllByStoryVersionId(storyVersionId);
    CursorPage<Chapter> firstPage = repository.findPageByStoryVersionId(storyVersionId, null, 2);
    CursorPage<Chapter> secondPage =
        repository.findPageByStoryVersionId(storyVersionId, firstPage.nextCursor(), 2);

    assertEquals(List.of(0, 1, 2), all.stream().map(Chapter::getOrderIndex).toList());
    assertEquals(List.of(0, 1), firstPage.content().stream().map(Chapter::getOrderIndex).toList());
    assertTrue(firstPage.hasNext());
    assertEquals(List.of(2), secondPage.content().stream().map(Chapter::getOrderIndex).toList());
    assertTrue(!secondPage.hasNext());
  }

  @Test
  void incrementsVersionAndRejectsStaleSourceUpdate() {
    UUID storyVersionId = insertStoryVersion();
    Chapter created =
        repository.save(new Chapter(storyVersionId, 0, "Original", "hello", HASH_HELLO));
    Chapter stale = repository.findById(created.getId()).orElseThrow();
    Chapter current = repository.findById(created.getId()).orElseThrow();

    current.rename("Updated");
    current.updateSource("server update", HASH_UPDATED);
    Chapter updated = repository.saveAndFlush(current);

    assertEquals(1L, updated.getRowVersion());
    assertThrows(OptimisticLockingFailureException.class, () -> repository.save(stale));
    Chapter stillCurrent = repository.findById(created.getId()).orElseThrow();
    assertEquals("server update", stillCurrent.getSourceText());
    assertEquals(HASH_UPDATED, stillCurrent.getSourceHash());
    assertEquals(1L, stillCurrent.getRowVersion());
  }

  @Test
  void rollsBackChapterUpdateWithTheSpringTransaction() {
    UUID storyVersionId = insertStoryVersion();
    Chapter created =
        repository.save(new Chapter(storyVersionId, 0, "Original", "hello", HASH_HELLO));

    assertThrows(
        IllegalStateException.class,
        () ->
            transactionTemplate.executeWithoutResult(
                status -> {
                  Chapter update = repository.findById(created.getId()).orElseThrow();
                  update.updateSource("must rollback", HASH_UPDATED);
                  repository.save(update);
                  throw new IllegalStateException("rollback probe");
                }));

    Chapter reloaded = repository.findById(created.getId()).orElseThrow();
    assertEquals("hello", reloaded.getSourceText());
    assertEquals(HASH_HELLO, reloaded.getSourceHash());
    assertEquals(0L, reloaded.getRowVersion());
  }

  @Test
  void translatesForeignKeyAndUniqueConstraintFailures() {
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            repository.save(
                new Chapter(
                    com.narrativex.backend.feature.common.uuid.UuidV7.random(),
                    0,
                    "Invalid",
                    "hello",
                    HASH_HELLO)));

    UUID storyVersionId = insertStoryVersion();
    repository.save(new Chapter(storyVersionId, 0, "First", "hello", HASH_HELLO));
    assertThrows(
        DataIntegrityViolationException.class,
        () -> repository.save(new Chapter(storyVersionId, 0, "Duplicate", "hello", HASH_HELLO)));
  }

  private UUID insertStoryVersion() {
    String suffix = com.narrativex.backend.feature.common.uuid.UuidV7.random().toString();
    UUID projectId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO projects
              (name, owner_id, status, source_language, narration_language, metadata_language,
               image_aspect_ratio, image_quality_tier)
            VALUES (?, 'chapter-test-owner', 'DRAFT', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD')
            RETURNING id
            """,
            UUID.class,
            "Chapter test " + suffix);
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO story_versions
          (project_id, version_number, content, source_language, status)
        VALUES (?, 1, 'story', 'vi-VN', 'DRAFT')
        RETURNING id
        """,
        UUID.class,
        projectId);
  }
}
