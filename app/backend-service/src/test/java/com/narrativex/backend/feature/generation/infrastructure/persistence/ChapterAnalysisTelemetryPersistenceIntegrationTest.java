package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.analysis.CanonHashCalculator;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
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
class ChapterAnalysisTelemetryPersistenceIntegrationTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_telemetry_test")
          .withUsername("narrativex")
          .withPassword("narrativex");

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.flyway.enabled", () -> true);
  }

  @Autowired private ChapterAnalysisRunRepository analysisRunRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  private UUID projectId;
  private UUID chapterId;
  private UUID storyboardRevisionId;
  private String sourceHash;

  @BeforeEach
  void setUp() {
    projectId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    chapterId = UuidV7.random();
    storyboardRevisionId = UuidV7.random();
    sourceHash = CanonHashCalculator.sha256("Chapter 1: The First Step");

    jdbcTemplate.update(
        "INSERT INTO projects (id, name, status, source_language, narration_language, metadata_language, image_aspect_ratio) "
            + "VALUES (?, 'Telemetry Test Project', 'ACTIVE', 'vi', 'vi', 'vi', '16:9')",
        projectId);

    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status) "
            + "VALUES (?, ?, 1, 'Story Version 1', 'vi', 'ACTIVE')",
        storyVersionId,
        projectId);

    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status) "
            + "VALUES (?, ?, 1, 'Chapter 1', 'Chapter 1: The First Step', ?, 'DRAFT')",
        chapterId,
        storyVersionId,
        sourceHash);

    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) "
            + "VALUES (?, ?, 1, ?, 1, 'DRAFT')",
        storyboardRevisionId,
        chapterId,
        sourceHash);
  }

  @Test
  @DisplayName("Persist analysis telemetry and retrieve by chapter, job, and list")
  void recordsAndQueriesAnalysisTelemetrySuccessfully() {
    UUID runId = UuidV7.random();
    String canonHash =
        CanonHashCalculator.computeCanonHash("{\"canon\":{\"characters\":[],\"locations\":[]}}");

    ChapterAnalysisRun run =
        new ChapterAnalysisRun(
            runId,
            null,
            chapterId,
            storyboardRevisionId,
            sourceHash,
            "gemini-3.8-flash",
            "1.0",
            "1.0",
            1500,
            420,
            300,
            120,
            1920,
            1850,
            canonHash,
            Instant.now());

    ChapterAnalysisRun saved = analysisRunRepository.recordRun(run);
    assertNotNull(saved);
    assertEquals(runId, saved.id());
    assertEquals(chapterId, saved.chapterId());
    assertEquals(storyboardRevisionId, saved.storyboardRevisionId());
    assertEquals(sourceHash, saved.sourceHash());
    assertEquals("gemini-3.8-flash", saved.model());
    assertEquals("1.0", saved.promptVersion());
    assertEquals("1.0", saved.schemaVersion());
    assertEquals(1500, saved.promptTokens());
    assertEquals(420, saved.outputTokens());
    assertEquals(300, saved.thinkingTokens());
    assertEquals(120, saved.cachedTokens());
    assertEquals(1920, saved.totalTokens());
    assertEquals(1850, saved.runtimeMs());
    assertEquals(canonHash, saved.canonHash());
    assertNotNull(saved.createdAt());

    Optional<ChapterAnalysisRun> latest = analysisRunRepository.findLatestByChapterId(chapterId);
    assertTrue(latest.isPresent());
    assertEquals(runId, latest.get().id());
    assertEquals(1500, latest.get().promptTokens());

    List<ChapterAnalysisRun> allRuns = analysisRunRepository.findByChapterId(chapterId);
    assertEquals(1, allRuns.size());
    assertEquals(runId, allRuns.get(0).id());
  }

  @Test
  @DisplayName("Rejects malformed sourceHash or canonHash via database regex constraint")
  void enforcesHashConstraints() {
    String invalidHash = "not-a-valid-sha256";
    String validCanonHash = CanonHashCalculator.sha256("valid-canon");

    ChapterAnalysisRun invalidRun =
        new ChapterAnalysisRun(
            UuidV7.random(),
            null,
            chapterId,
            storyboardRevisionId,
            invalidHash,
            "gemini-3.8-flash",
            "1.0",
            "1.0",
            100,
            50,
            0,
            0,
            150,
            200,
            validCanonHash,
            Instant.now());

    assertThrows(
        DataIntegrityViolationException.class, () -> analysisRunRepository.recordRun(invalidRun));
  }
}
