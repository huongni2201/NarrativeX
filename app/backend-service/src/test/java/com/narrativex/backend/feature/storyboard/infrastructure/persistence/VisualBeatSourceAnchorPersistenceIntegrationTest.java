package com.narrativex.backend.feature.storyboard.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
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
class VisualBeatSourceAnchorPersistenceIntegrationTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_anchor_test")
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
  }

  @Autowired private StoryboardMapper storyboardMapper;
  @Autowired private ChapterMapper chapterMapper;
  @Autowired private SourceAnchorResolver sourceAnchorResolver;
  @Autowired private JdbcTemplate jdbcTemplate;

  private UUID projectId;
  private UUID storyVersionId;
  private UUID chapterId;
  private UUID revisionId;
  private UUID sceneId;

  @BeforeEach
  void setUpHierarchy() {
    projectId = UuidV7.random();
    storyVersionId = UuidV7.random();
    chapterId = UuidV7.random();
    revisionId = UuidV7.random();

    jdbcTemplate.update(
        "INSERT INTO projects (id, name, status, source_language, narration_language, metadata_language, image_aspect_ratio) VALUES (?, ?, 'ACTIVE', 'vi', 'vi', 'vi', '16:9')",
        projectId,
        "Anchor Test Project");
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status) VALUES (?, ?, 1, 'Sample story content', 'vi', 'ACTIVE')",
        storyVersionId,
        projectId);

    ChapterRow chapter = new ChapterRow();
    chapter.setId(chapterId);
    chapter.setStoryVersionId(storyVersionId);
    chapter.setOrderIndex(0);
    chapter.setTitle("Chapter 1");
    chapter.setSourceText("Once upon a time in a faraway realm, an ancient hero arose.");
    chapter.setSourceHash("a".repeat(64));
    chapter.setStatus("DRAFT");
    chapter.setCreatedAt(Instant.now());
    chapter.setUpdatedAt(Instant.now());
    chapterId = chapterMapper.insert(chapter);
    chapter.setId(chapterId);

    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) VALUES (?, ?, 1, repeat('a', 64), 0, 'DRAFT')",
        revisionId,
        chapterId);

    chapter.setCurrentStoryboardRevisionId(revisionId);
    chapter.setUpdatedAt(Instant.now());
    chapterMapper.update(chapter);

    SceneRow scene = new SceneRow();
    scene.setChapterId(chapterId);
    scene.setStoryboardRevisionId(revisionId);
    scene.setProjectId(projectId);
    scene.setOrderIndex(0);
    scene.setTitle("Scene 1");
    scene.setNarration("Once upon a time in a faraway realm, an ancient hero arose.");
    scene.setStatus("DRAFT");
    scene.setCreatedAt(Instant.now());
    scene.setUpdatedAt(Instant.now());
    sceneId = storyboardMapper.insertScene(scene);
  }

  @Test
  @DisplayName("Persists and retrieves visual beat source anchor fields in PostgreSQL")
  void persistsAndRetrievesSourceAnchorFields() throws Exception {
    String sourceText = "Once upon a time in a faraway realm, an ancient hero arose.";
    String anchor = "faraway realm";
    var resolved = sourceAnchorResolver.resolveAll(sourceText, "a".repeat(64), List.of(anchor)).get(0);

    Instant now = Instant.now();
    VisualBeatRow row = new VisualBeatRow();
    row.setSceneId(sceneId);
    row.setOrderIndex(0);
    row.setTitle("Beat 1");
    row.setVisualIntent("Hero appears");
    row.setVisualDirectionJson("{\"shot_size\":\"WIDE\"}");
    row.setReviewStatus("NEEDS_REVIEW");
    row.setMotionMode("STILL");
    row.setTextStart(resolved.textStart());
    row.setTextEnd(resolved.textEnd());
    row.setSourceAnchorJson(resolved.sourceAnchorJson());
    row.setCreatedAt(now);
    row.setUpdatedAt(now);

    UUID beatId = storyboardMapper.insertVisualBeat(row);
    assertNotNull(beatId);

    VisualBeatRow retrieved = storyboardMapper.findVisualBeat(beatId);
    assertNotNull(retrieved);
    assertEquals(resolved.textStart(), retrieved.getTextStart());
    assertEquals(resolved.textEnd(), retrieved.getTextEnd());
    assertNotNull(retrieved.getSourceAnchorJson());
    com.fasterxml.jackson.databind.JsonNode anchorJson =
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(retrieved.getSourceAnchorJson());
    assertEquals(resolved.textStart(), anchorJson.get("textStart").asInt());
    assertEquals(resolved.textEnd(), anchorJson.get("textEnd").asInt());
    assertEquals("a".repeat(64), anchorJson.get("sourceHash").asText());

    // Verify findVisualBeats
    List<VisualBeatRow> beats = storyboardMapper.findVisualBeats(List.of(sceneId));
    assertEquals(1, beats.size());
    assertEquals(resolved.textStart(), beats.get(0).getTextStart());
    assertEquals(resolved.textEnd(), beats.get(0).getTextEnd());
  }

  @Test
  @DisplayName("PostgreSQL check constraint rejects invalid source_anchor_json ranges")
  void databaseRejectsInvalidSourceAnchorRanges() {
    Instant now = Instant.now();
    VisualBeatRow row = new VisualBeatRow();
    row.setSceneId(sceneId);
    row.setOrderIndex(1);
    row.setTitle("Invalid Beat");
    row.setVisualIntent("Invalid");
    row.setVisualDirectionJson("{}");
    row.setReviewStatus("NEEDS_REVIEW");
    row.setMotionMode("STILL");
    row.setTextStart(10);
    row.setTextEnd(5); // textEnd <= textStart violates check constraint!
    row.setSourceAnchorJson("{\"textStart\":10,\"textEnd\":5,\"sourceHash\":\"" + "a".repeat(64) + "\"}");
    row.setCreatedAt(now);
    row.setUpdatedAt(now);

    assertThrows(DataIntegrityViolationException.class, () -> storyboardMapper.insertVisualBeat(row));
  }
}
