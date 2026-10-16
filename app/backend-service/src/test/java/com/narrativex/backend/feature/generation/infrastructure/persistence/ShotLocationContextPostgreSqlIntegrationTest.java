package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.port.out.ShotLocationContextRepository;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ShotLocationContextPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired JdbcTemplate jdbc;
  @Autowired ShotLocationContextRepository repository;

  private UUID project;
  private UUID chapter;
  private UUID revision;
  private UUID hall;

  @BeforeEach
  void fixture() {
    project =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('loc-ctx','DRAFT','en','en','RATIO_16_9') RETURNING id");
    UUID story =
        id(
            "INSERT INTO story_versions(project_id,version_number,content,source_language,status) VALUES (?,1,'Fixture','en','ACTIVE') RETURNING id",
            project);
    chapter =
        id(
            "INSERT INTO chapters(story_version_id,order_index,title,source_text,source_hash) VALUES (?,1,'Fixture','Fixture',?) RETURNING id",
            story,
            "a".repeat(64));
    revision =
        id(
            "INSERT INTO storyboard_revisions(chapter_id,revision_number,source_hash,source_row_version) VALUES (?,1,?,0) RETURNING id",
            chapter,
            "a".repeat(64));
    hall =
        id(
            "INSERT INTO project_locations(project_id,name,description,visual_prompt) VALUES (?,'Main Hall','mô tả','Wide hall, red pillars') RETURNING id",
            project);
  }

  @Test
  void shotsOfOneSceneShareTheSceneLocationAndChainThroughBeatSequenceShotOrder() {
    UUID scene = scene(1, hall);
    // Insert out of reading order to prove the order comes from order_index, not insertion.
    UUID beat2 = beat(scene, 2);
    UUID beat1 = beat(scene, 1);
    UUID seq2 = sequence(beat2, 0);
    UUID seq1 = sequence(beat1, 0);
    UUID shot2b = shot(seq2, 1, "{\"state\":\"beat2 second\"}");
    UUID shot2a = shot(seq2, 0, "{\"state\":\"beat2 first\"}");
    UUID shot1b = shot(seq1, 1, "{\"state\":\"beat1 second\"}");
    UUID shot1a = shot(seq1, 0, "{\"state\":\"beat1 first\"}");

    var contexts = repository.findForShots(project, List.of(shot1a, shot1b, shot2a, shot2b));

    assertThat(contexts).hasSize(4);
    assertThat(contexts.values())
        .allSatisfy(
            context -> {
              assertThat(context.location().locationId()).isEqualTo(hall);
              assertThat(context.location().name()).isEqualTo("Main Hall");
              assertThat(context.location().visualPrompt()).isEqualTo("Wide hall, red pillars");
            });
    assertThat(contexts.get(shot1a).previousShotId()).isNull();
    assertThat(contexts.get(shot1b).previousShotId()).isEqualTo(shot1a);
    assertThat(contexts.get(shot2a).previousShotId()).isEqualTo(shot1b);
    assertThat(contexts.get(shot2b).previousShotId()).isEqualTo(shot2a);
    assertThat(contexts.get(shot2b).previousEndStateJson()).contains("beat2 first");
    assertThat(contexts.get(shot2a).previousEndStateJson()).contains("beat1 second");
  }

  @Test
  void predecessorIsFoundEvenWhenItIsNotInTheRequestedSet() {
    UUID scene = scene(1, hall);
    UUID sequence = sequence(beat(scene, 1), 0);
    UUID first = shot(sequence, 0, "{\"state\":\"opening\"}");
    UUID second = shot(sequence, 1, "{}");

    var context = repository.findForShot(project, second);

    assertThat(context.previousShotId()).isEqualTo(first);
    assertThat(context.previousEndStateJson()).contains("opening");
  }

  @Test
  void continuityNeverCrossesSceneBoundariesAndSceneWithoutLocationHasNone() {
    UUID sceneA = scene(1, hall);
    UUID sceneB = scene(2, null);
    UUID shotA = shot(sequence(beat(sceneA, 1), 0), 0, "{\"state\":\"A\"}");
    UUID shotB = shot(sequence(beat(sceneB, 1), 0), 0, "{}");

    var contexts = repository.findForShots(project, List.of(shotA, shotB));

    assertThat(contexts.get(shotB).previousShotId()).isNull();
    assertThat(contexts.get(shotB).location()).isNull();
    assertThat(contexts.get(shotA).location().locationId()).isEqualTo(hall);
  }

  @Test
  void anotherProjectCannotResolveTheShots() {
    UUID scene = scene(1, hall);
    UUID shot = shot(sequence(beat(scene, 1), 0), 0, "{}");
    UUID otherProject =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('other','DRAFT','en','en','RATIO_16_9') RETURNING id");

    assertThat(repository.findForShots(otherProject, List.of(shot))).isEmpty();
    assertThat(repository.findForShots(project, List.of())).isEmpty();
  }

  private UUID scene(int order, UUID location) {
    return id(
        "INSERT INTO scenes(storyboard_revision_id,chapter_id,project_id,project_location_id,order_index,title) VALUES (?,?,?,?,?,'Scene') RETURNING id",
        revision,
        chapter,
        project,
        location,
        order);
  }

  private UUID beat(UUID scene, int order) {
    return id(
        "INSERT INTO visual_beats(scene_id,order_index,title,visual_intent,review_status) VALUES (?,?,'Beat','Beat','APPROVED') RETURNING id",
        scene,
        order);
  }

  private UUID sequence(UUID beat, int order) {
    return id(
        "INSERT INTO shot_sequences(visual_beat_id,order_index) VALUES (?,?) RETURNING id",
        beat,
        order);
  }

  private UUID shot(UUID sequence, int order, String endStateJson) {
    return id(
        "INSERT INTO shots(sequence_id,order_index,narrative_purpose,end_state_json) VALUES (?,?,'Fixture',?::jsonb) RETURNING id",
        sequence,
        order,
        endStateJson);
  }

  private UUID id(String sql, Object... arguments) {
    return jdbc.queryForObject(sql, UUID.class, arguments);
  }
}
