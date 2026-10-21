package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class TakeQualityControlPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired JdbcTemplate jdbc;
  @Autowired TakeMapper takes;

  @Test
  void storesMeasurementsUnderOneKeyAndKeepsEverythingElse() {
    UUID take = seedTake("{\"whisperx\":{\"expectedText\":\"xin chao\"}}");

    int updated =
        takes.updateQualityControl(take, "{\"status\":\"MEASURED\",\"freezeHeadMs\":417}");

    assertThat(updated).isEqualTo(1);
    Map<String, Object> row =
        jdbc.queryForMap(
            "SELECT metrics_json->'qualityControl'->>'status' AS status,"
                + " (metrics_json->'qualityControl'->>'freezeHeadMs')::int AS freeze_head,"
                + " metrics_json->'whisperx'->>'expectedText' AS expected,"
                + " validation_status, status AS take_status, row_version FROM takes WHERE id=?",
            take);
    assertThat(row)
        .containsEntry("status", "MEASURED")
        .containsEntry("freeze_head", 417)
        .containsEntry("expected", "xin chao")
        .containsEntry("validation_status", "PASSED")
        .containsEntry("take_status", "PASSED")
        .containsEntry("row_version", 1L);
  }

  @Test
  void rewritingReplacesThePreviousMeasurementInsteadOfMergingIt() {
    UUID take = seedTake("{}");
    takes.updateQualityControl(take, "{\"status\":\"MEASURED\",\"freezeHeadMs\":417}");

    takes.updateQualityControl(take, "{\"status\":\"UNAVAILABLE\",\"reason\":\"timed out\"}");

    Map<String, Object> row =
        jdbc.queryForMap(
            "SELECT metrics_json->'qualityControl'->>'status' AS status,"
                + " metrics_json->'qualityControl'->'freezeHeadMs' IS NOT NULL AS stale_field"
                + " FROM takes WHERE id=?",
            take);
    assertThat(row).containsEntry("status", "UNAVAILABLE").containsEntry("stale_field", false);
  }

  private UUID seedTake(String metricsJson) {
    UUID project =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('take-qc','DRAFT','en','en','RATIO_16_9') RETURNING id");
    UUID story =
        id(
            "INSERT INTO story_versions(project_id,version_number,content,source_language,status) VALUES (?,1,'Fixture','en','ACTIVE') RETURNING id",
            project);
    UUID chapter =
        id(
            "INSERT INTO chapters(story_version_id,order_index,title,source_text,source_hash) VALUES (?,1,'Fixture','Fixture',?) RETURNING id",
            story,
            "a".repeat(64));
    UUID revision =
        id(
            "INSERT INTO storyboard_revisions(chapter_id,revision_number,source_hash,source_row_version) VALUES (?,1,?,0) RETURNING id",
            chapter,
            "a".repeat(64));
    UUID scene =
        id(
            "INSERT INTO scenes(storyboard_revision_id,chapter_id,project_id,order_index,title) VALUES (?,?,?,1,'Fixture') RETURNING id",
            revision,
            chapter,
            project);
    UUID beat =
        id(
            "INSERT INTO visual_beats(scene_id,order_index,title,visual_intent,review_status) VALUES (?,1,'Fixture','Fixture','APPROVED') RETURNING id",
            scene);
    UUID sequence = id("INSERT INTO shot_sequences(visual_beat_id) VALUES (?) RETURNING id", beat);
    UUID shot =
        id(
            "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,0,'Fixture') RETURNING id",
            sequence);
    return id(
        "INSERT INTO takes(shot_id,attempt_number,source_duration_ms,validation_status,status,metrics_json) VALUES (?,1,1000,'PASSED','PASSED',?::jsonb) RETURNING id",
        shot,
        metricsJson);
  }

  private UUID id(String sql, Object... arguments) {
    return jdbc.queryForObject(sql, UUID.class, arguments);
  }
}
