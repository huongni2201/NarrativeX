package com.narrativex.backend.feature.storyboard.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class StoryBeatSceneIntegrityIntegrationTest extends PostgreSqlIntegrationTestSupport {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void enforcesStoryBeatAndSceneIntegrity() {
    UUID projectId = UUID.randomUUID();
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, status, source_language, narration_language, metadata_language, image_aspect_ratio) "
            + "VALUES (?, 'Integrity Project', 'DRAFT', 'en-US', 'en-US', 'en-US', 'RATIO_16_9')",
        projectId);

    UUID storyVersionId = UUID.randomUUID();
    jdbcTemplate.update(
        "INSERT INTO story_versions (id, project_id, version_number, status, content, source_language) "
            + "VALUES (?, ?, 1, 'ACTIVE', 'Story Content', 'en-US')",
        storyVersionId,
        projectId);

    UUID chapterId = UUID.randomUUID();
    String validSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    jdbcTemplate.update(
        "INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status) "
            + "VALUES (?, ?, 1, 'Chapter 1', 'Source text content', ?, 'DRAFT')",
        chapterId,
        storyVersionId,
        validSha256);

    UUID revisionId = UUID.randomUUID();
    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version) "
            + "VALUES (?, ?, 1, ?, 0)",
        revisionId,
        chapterId,
        validSha256);

    UUID sceneA = UUID.randomUUID();
    UUID sceneB = UUID.randomUUID();
    jdbcTemplate.update(
        "INSERT INTO scenes (id, chapter_id, storyboard_revision_id, project_id, order_index, title) VALUES (?, ?, ?, ?, 1, 'Scene A')",
        sceneA,
        chapterId,
        revisionId,
        projectId);
    jdbcTemplate.update(
        "INSERT INTO scenes (id, chapter_id, storyboard_revision_id, project_id, order_index, title) VALUES (?, ?, ?, ?, 2, 'Scene B')",
        sceneB,
        chapterId,
        revisionId,
        projectId);

    UUID storyBeatA = UUID.randomUUID();
    jdbcTemplate.update(
        "INSERT INTO story_beats (id, scene_id, order_index, purpose, summary) VALUES (?, ?, 1, 'Purpose A', 'Summary A')",
        storyBeatA,
        sceneA);

    UUID storyBeatB = UUID.randomUUID();
    jdbcTemplate.update(
        "INSERT INTO story_beats (id, scene_id, order_index, purpose, summary) VALUES (?, ?, 1, 'Purpose B', 'Summary B')",
        storyBeatB,
        sceneB);

    // 1. Same scene: VisualBeat Scene A + StoryBeat Scene A -> PASS
    UUID visualBeat1 = UUID.randomUUID();
    assertDoesNotThrow(
        () ->
            jdbcTemplate.update(
                "INSERT INTO visual_beats (id, scene_id, story_beat_id, order_index, title, visual_intent, visual_direction_json) "
                    + "VALUES (?, ?, ?, 1, 'VB1', 'Intent 1', '{\"shot_size\":\"MEDIUM\",\"camera_angle\":\"EYE_LEVEL\",\"lens_mm\":50,\"focus_target\":\"target\",\"action_phase\":\"AFTER\",\"subject_placement\":\"center\",\"motivated_light\":\"light\",\"palette\":\"palette\",\"camera_movement\":\"NONE\",\"movement_direction\":\"NONE\",\"movement_intensity\":\"NONE\",\"crop_safe_area\":\"safe\"}')",
                visualBeat1,
                sceneA,
                storyBeatA));

    // 2. Legacy/unassigned: VisualBeat Scene A + null StoryBeat -> PASS
    UUID visualBeat2 = UUID.randomUUID();
    assertDoesNotThrow(
        () ->
            jdbcTemplate.update(
                "INSERT INTO visual_beats (id, scene_id, story_beat_id, order_index, title, visual_intent, visual_direction_json) "
                    + "VALUES (?, ?, NULL, 2, 'VB2', 'Intent 2', '{\"shot_size\":\"MEDIUM\",\"camera_angle\":\"EYE_LEVEL\",\"lens_mm\":50,\"focus_target\":\"target\",\"action_phase\":\"AFTER\",\"subject_placement\":\"center\",\"motivated_light\":\"light\",\"palette\":\"palette\",\"camera_movement\":\"NONE\",\"movement_direction\":\"NONE\",\"movement_intensity\":\"NONE\",\"crop_safe_area\":\"safe\"}')",
                visualBeat2,
                sceneA));

    // 3. Cross-scene mismatch: VisualBeat Scene A + StoryBeat Scene B -> FAIL (FK violation)
    UUID visualBeat3 = UUID.randomUUID();
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            jdbcTemplate.update(
                "INSERT INTO visual_beats (id, scene_id, story_beat_id, order_index, title, visual_intent, visual_direction_json) "
                    + "VALUES (?, ?, ?, 3, 'VB3', 'Intent 3', '{\"shot_size\":\"MEDIUM\",\"camera_angle\":\"EYE_LEVEL\",\"lens_mm\":50,\"focus_target\":\"target\",\"action_phase\":\"AFTER\",\"subject_placement\":\"center\",\"motivated_light\":\"light\",\"palette\":\"palette\",\"camera_movement\":\"NONE\",\"movement_direction\":\"NONE\",\"movement_intensity\":\"NONE\",\"crop_safe_area\":\"safe\"}')",
                visualBeat3,
                sceneA,
                storyBeatB));
  }
}
