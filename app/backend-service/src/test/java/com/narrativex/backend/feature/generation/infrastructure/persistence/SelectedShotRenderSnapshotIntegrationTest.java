package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Exercises real PostgreSQL ordering and preserves the distinction between source and edit time.
 */
class SelectedShotRenderSnapshotIntegrationTest extends ShotTakeAdmissionPostgreSqlIntegrationTest {
  @Autowired ProductionTimelineMapper timeline;

  @Test
  void selectedTakeCannotExposeAnotherProjectsMedia() {
    UUID otherProject =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,metadata_language,image_aspect_ratio) VALUES ('other','DRAFT','en','en','en','RATIO_16_9') RETURNING id");
    UUID asset =
        id(
            "INSERT INTO media_assets(id,project_id,asset_type,origin,status,storage_key,original_filename,content_type,size_bytes,sha256,duration_ms) VALUES (uuidv7(),?,'VIDEO','VIDEO_GENERATED','READY',?,'fixture.mp4','video/mp4',1024,?,5000) RETURNING id",
            otherProject,
            "assets/" + UUID.randomUUID() + ".mp4",
            "b".repeat(64));
    UUID take =
        id(
            "INSERT INTO takes(shot_id,attempt_number,output_asset_id,source_duration_ms,status,validation_status) VALUES (?,1,?,5000,'PASSED','PASSED') RETURNING id",
            shotId,
            asset);
    jdbc.update(
        "INSERT INTO selected_takes(shot_id,take_id,source_in_ms,source_out_ms) VALUES (?,?,0,5000)",
        shotId,
        take);

    var cuts = timeline.findBeats(projectId);

    assertThat(cuts).hasSize(1);
    assertThat(cuts.getFirst().getMediaAssetId()).isNull();
    assertThat(cuts.getFirst().getStorageKey()).isNull();
  }

  @Test
  void everySelectedShotOnOneBeatKeepsSourceDurationAndTrim() {
    UUID sequence =
        jdbc.queryForObject("SELECT sequence_id FROM shots WHERE id=?", UUID.class, shotId);
    UUID[] shots = {
      shotId,
      id(
          "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,2,'Second') RETURNING id",
          sequence),
      id(
          "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,3,'Third') RETURNING id",
          sequence)
    };
    for (UUID shot : shots) {
      UUID asset =
          id(
              "INSERT INTO media_assets(id,project_id,asset_type,origin,status,storage_key,original_filename,content_type,size_bytes,sha256,duration_ms) VALUES (uuidv7(),?,'VIDEO','VIDEO_GENERATED','READY',?,'fixture.mp4','video/mp4',1024,?,5000) RETURNING id",
              projectId,
              "assets/" + shot + ".mp4",
              "b".repeat(64));
      UUID take =
          id(
              "INSERT INTO takes(shot_id,attempt_number,provider,model,generation_mode,output_asset_id,source_duration_ms,status,validation_status) VALUES (?,1,'ltx','ltx-2.5-22b-distilled-int8','TEXT_TO_VIDEO',?,5000,'PASSED','PASSED') RETURNING id",
              shot,
              asset);
      jdbc.update(
          "INSERT INTO selected_takes(shot_id,take_id,source_in_ms,source_out_ms) VALUES (?,?,2000,5000)",
          shot,
          take);
      if (shot.equals(shotId)) {
        jdbc.update(
            "INSERT INTO production_beat_media_selections(project_id,visual_beat_id,media_asset_id,fit_mode,trim_start_ms) VALUES (?,?,?,'LOOP',0)",
            projectId,
            beatId,
            asset);
      }
    }
    var cuts = timeline.findBeats(projectId);
    assertThat(cuts).hasSize(3);
    assertThat(cuts).extracting(c -> c.getShotId()).containsExactly(shots);
    assertThat(cuts)
        .allSatisfy(
            c -> {
              assertThat(c.getSourceDurationMs()).isEqualTo(5000);
              assertThat(c.getTrimStartMs()).isEqualTo(2000);
              assertThat(c.getFitMode()).isEqualTo("TRIM");
            });
  }
}
