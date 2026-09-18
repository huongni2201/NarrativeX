package com.narrativex.backend.feature.storyboard.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectCharacterBindingRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectLocationBindingRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneCharacterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatCharacterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
class ChapterCanonMaterializationIntegrationTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_canon_test")
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
  @Autowired private ChapterCanonMapper canonMapper;
  @Autowired private ChapterCanonReconciliationService canonReconciliationService;
  @Autowired private SourceAnchorResolver sourceAnchorResolver;
  @Autowired private JdbcTemplate jdbcTemplate;

  private UUID projectId;
  private UUID storyVersionId;
  private UUID chapterId;
  private UUID revisionId;
  private String sourceText;
  private String sourceHash;

  @BeforeEach
  void setUp() throws Exception {
    projectId = UuidV7.random();
    storyVersionId = UuidV7.random();
    chapterId = UuidV7.random();
    revisionId = UuidV7.random();
    sourceText = "Once upon a time in a faraway realm, an ancient hero arose to defend the realm.";
    byte[] digest = MessageDigest.getInstance("SHA-256").digest(sourceText.getBytes(StandardCharsets.UTF_8));
    sourceHash = HexFormat.of().formatHex(digest);

    jdbcTemplate.update(
        "INSERT INTO projects (id, name, status, source_language, narration_language, metadata_language, image_aspect_ratio) VALUES (?, ?, 'ACTIVE', 'vi', 'vi', 'vi', '16:9')",
        projectId,
        "Canon Materialization Project");
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, content, source_language, status) VALUES (?, ?, 1, 'Story', 'vi', 'ACTIVE')",
        storyVersionId,
        projectId);

    ChapterRow chapter = new ChapterRow();
    chapter.setId(chapterId);
    chapter.setStoryVersionId(storyVersionId);
    chapter.setOrderIndex(0);
    chapter.setTitle("Chapter 1");
    chapter.setSourceText(sourceText);
    chapter.setSourceHash(sourceHash);
    chapter.setStatus("DRAFT");
    chapter.setCreatedAt(Instant.now());
    chapter.setUpdatedAt(Instant.now());
    chapterId = chapterMapper.insert(chapter);
    chapter.setId(chapterId);

    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status) VALUES (?, ?, 1, ?, 0, 'DRAFT')",
        revisionId,
        chapterId,
        sourceHash);
  }

  @Test
  @DisplayName("Full materialization reconciles canon, creates scene/beat character bindings and locations")
  void fullCanonMaterializationSucceeds() {
    var materializer =
        new ChapterAnalysisArtifactMaterializerTestAccessor(
            storyboardMapper,
            chapterMapper,
            sourceAnchorResolver,
            canonMapper,
            canonReconciliationService);

    GenerationJob job =
        GenerationJob.createChapterAnalysis(
            projectId,
            storyVersionId,
            chapterId,
            revisionId,
            0L,
            sourceHash,
            sourceText,
            "vi",
            "idem-key-" + UuidV7.random());

    String payload =
        """
        {
          "canon": {
            "characters": [
              {
                "ai_name": "char_elena",
                "canonical_name": "Elena Vance",
                "aliases": ["Elena", "Dr. Vance"],
                "role": "PROTAGONIST",
                "importance": "PRIMARY",
                "description": "Lead scientist researching relics",
                "visual_prompt": "woman in late 20s with short dark hair, white lab coat, glasses"
              },
              {
                "ai_name": "char_lucas",
                "canonical_name": "Lucas Cole",
                "aliases": ["Lucas"],
                "role": "SUPPORTING",
                "importance": "SECONDARY",
                "description": "Security officer",
                "visual_prompt": "tall muscular man in tactical vest with scarred cheek"
              }
            ],
            "locations": [
              {
                "ai_name": "loc_bunker",
                "canonical_name": "Underground Bunker 9",
                "aliases": ["Bunker", "The Vault"],
                "description": "Subterranean research facility",
                "visual_prompt": "industrial reinforced concrete hall with dim emergency lighting"
              }
            ]
          },
          "scenes": [
            {
              "title": "Scene 1: The Briefing",
              "narration": "Once upon a time in a faraway realm, an ancient hero arose to defend the realm.",
              "location": "loc_bunker",
              "characters": ["char_elena", "char_lucas"],
              "visual_beats": [
                {
                  "title": "Elena analyzes relic",
                  "visual_intent": "Elena examining glowing relic on bench",
                  "source_anchor": "Once upon a time in a faraway realm",
                  "characters": ["char_elena"],
                  "visual_direction": {
                    "shot_size": "CLOSE_UP",
                    "camera_angle": "EYE_LEVEL",
                    "lens_mm": 50,
                    "focus_target": "Elena's focused face",
                    "action_phase": "DURING",
                    "subject_placement": "CENTER",
                    "background": "Dark bunker monitors",
                    "motivated_light": "Relic cyan glow from below",
                    "palette": "Cool blues and amber warnings",
                    "camera_movement": "STATIC",
                    "movement_intensity": "SUBTLE",
                    "crop_safe_area": "16:9"
                  }
                },
                {
                  "title": "Lucas warns Elena",
                  "visual_intent": "Lucas stands in doorway with rifle",
                  "source_anchor": "an ancient hero arose to defend the realm.",
                  "characters": ["char_lucas"],
                  "visual_direction": {
                    "shot_size": "MEDIUM",
                    "camera_angle": "LOW_ANGLE",
                    "lens_mm": 35,
                    "focus_target": "Lucas in doorway",
                    "action_phase": "START",
                    "subject_placement": "LEFT_THIRD",
                    "background": "Heavy reinforced blast door",
                    "motivated_light": "Red corridor siren light",
                    "palette": "Red and deep shadow",
                    "camera_movement": "PUSH_IN",
                    "movement_intensity": "MODERATE",
                    "crop_safe_area": "16:9"
                  }
                }
              ]
            }
          ]
        }
        """;

    materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8));

    // 1. Verify project characters created
    List<ProjectCharacterBindingRow> charBindings = canonMapper.findProjectCharacterBindings(projectId);
    assertEquals(2, charBindings.size(), "Should have created 2 project characters");

    ProjectCharacterBindingRow elena =
        charBindings.stream()
            .filter(c -> "char_elena".equals(c.getAiName()) || "Elena Vance".equals(c.getCanonicalName()))
            .findFirst()
            .orElseThrow();
    assertEquals("Elena Vance", elena.getCanonicalName());

    ProjectCharacterBindingRow lucas =
        charBindings.stream()
            .filter(c -> "char_lucas".equals(c.getAiName()) || "Lucas Cole".equals(c.getCanonicalName()))
            .findFirst()
            .orElseThrow();
    assertEquals("Lucas Cole", lucas.getCanonicalName());

    // 2. Verify project locations created
    List<ProjectLocationBindingRow> locBindings = canonMapper.findProjectLocationBindings(projectId);
    assertEquals(1, locBindings.size(), "Should have created 1 project location");
    assertEquals("Underground Bunker 9", locBindings.get(0).getName());

    // 3. Verify scene materialized with location
    List<SceneRow> scenes = storyboardMapper.findCurrentScenes(chapterId);
    assertEquals(1, scenes.size(), "Should have 1 scene");
    SceneRow scene = scenes.get(0);
    assertEquals("Scene 1: The Briefing", scene.getTitle());
    assertEquals(locBindings.get(0).getProjectLocationId(), scene.getProjectLocationId());
    assertEquals("loc_bunker", scene.getLocationText());

    // 4. Verify scene_characters
    List<SceneCharacterRow> sceneChars = canonMapper.findSceneCharacters(scene.getId());
    assertEquals(2, sceneChars.size(), "Scene should link both characters");
    List<UUID> sceneCharIds = sceneChars.stream().map(SceneCharacterRow::getProjectCharacterId).toList();
    assertTrue(sceneCharIds.contains(elena.getProjectCharacterId()));
    assertTrue(sceneCharIds.contains(lucas.getProjectCharacterId()));

    // 5. Verify visual_beats and visual_beat_characters
    List<VisualBeatRow> beats = storyboardMapper.findVisualBeats(List.of(scene.getId()));
    assertEquals(2, beats.size(), "Should have 2 visual beats");

    VisualBeatRow beat0 = beats.get(0);
    List<VisualBeatCharacterRow> beat0Chars = canonMapper.findVisualBeatCharacters(beat0.getId());
    assertEquals(1, beat0Chars.size(), "Beat 0 should have 1 character");
    assertEquals(elena.getProjectCharacterId(), beat0Chars.get(0).getProjectCharacterId());

    VisualBeatRow beat1 = beats.get(1);
    List<VisualBeatCharacterRow> beat1Chars = canonMapper.findVisualBeatCharacters(beat1.getId());
    assertEquals(1, beat1Chars.size(), "Beat 1 should have 1 character");
    assertEquals(lucas.getProjectCharacterId(), beat1Chars.get(0).getProjectCharacterId());
  }

  @Test
  @DisplayName("Re-reconciliation on locked character preserves locked version and creates new draft version")
  void lockedCharacterVersionPreservedOnPromptChange() {
    fullCanonMaterializationSucceeds();

    // Find Elena's character and version
    List<ProjectCharacterBindingRow> charBindings = canonMapper.findProjectCharacterBindings(projectId);
    ProjectCharacterBindingRow elena =
        charBindings.stream()
            .filter(c -> "Elena Vance".equals(c.getCanonicalName()))
            .findFirst()
            .orElseThrow();

    // Lock Elena's character version
    jdbcTemplate.update(
        "UPDATE character_versions SET status = 'LOCKED', locked_at = NOW() WHERE character_id = ? AND version_number = 1",
        elena.getCharacterId());

    // Second analysis with updated costume
    var charUpdate =
        new com.narrativex.backend.feature.generation.application.model.analysis.AnalyzedCharacter(
            "char_elena",
            "Elena Vance",
            List.of("Elena"),
            "PROTAGONIST",
            "PRIMARY",
            "Elena in battle gear",
            "Updated prompt: armored exo-suit with plasma rifle");

    var canon = new com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanon(List.of(charUpdate), List.of());
    canonReconciliationService.reconcileAndPersist(projectId, canon);

    // Verify version 1 is still locked
    String v1Status = jdbcTemplate.queryForObject(
        "SELECT status FROM character_versions WHERE character_id = ? AND version_number = 1",
        String.class,
        elena.getCharacterId());
    assertEquals("LOCKED", v1Status);

    // Verify version 2 exists as DRAFT with new prompt
    String v2Status = jdbcTemplate.queryForObject(
        "SELECT status FROM character_versions WHERE character_id = ? AND version_number = 2",
        String.class,
        elena.getCharacterId());
    assertEquals("DRAFT", v2Status);

    String v2Prompt = jdbcTemplate.queryForObject(
        "SELECT visual_prompt FROM character_versions WHERE character_id = ? AND version_number = 2",
        String.class,
        elena.getCharacterId());
    assertEquals("Updated prompt: armored exo-suit with plasma rifle", v2Prompt);
  }

  /** Package-private wrapper to invoke materializer from test package. */
  static class ChapterAnalysisArtifactMaterializerTestAccessor {
    private final com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisArtifactMaterializer materializer;

    ChapterAnalysisArtifactMaterializerTestAccessor(
        StoryboardMapper storyboardMapper,
        ChapterMapper chapterMapper,
        SourceAnchorResolver sourceAnchorResolver,
        ChapterCanonMapper canonMapper,
        ChapterCanonReconciliationService canonReconciliationService) {
      this.materializer =
          new com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisArtifactMaterializer(
              storyboardMapper,
              chapterMapper,
              sourceAnchorResolver,
              canonMapper,
              canonReconciliationService);
    }

    void materialize(GenerationJob job, byte[] payload) {
      materializer.materialize(job, payload);
    }
  }
}
