package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import java.sql.Timestamp;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcMediaPlanPersistenceAdapter implements MediaPlanRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public int nextRevision(Long chapterId) {
    Integer next =
        jdbcTemplate.queryForObject(
            "SELECT COALESCE(MAX(revision), 0) + 1 FROM media_plans WHERE chapter_id = ?",
            Integer.class,
            chapterId);
    if (next == null || next <= 0) {
      throw new IllegalStateException("Could not allocate media plan revision for chapter " + chapterId);
    }
    return next;
  }

  @Override
  public MediaPlan save(MediaPlan plan) {
    jdbcTemplate.update(
        """
        INSERT INTO media_plans (
          id,
          chapter_id,
          chapter_row_version,
          source_hash,
          production_mode,
          revision,
          narration_characters,
          image_generate_count,
          image_edit_count,
          basic_motion_seconds,
          planned_i2v_seconds,
          estimated_cost,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        plan.id(),
        plan.chapterId(),
        plan.chapterRowVersion(),
        plan.sourceHash(),
        plan.productionMode().name(),
        plan.revision(),
        plan.workload().narrationCharacters(),
        plan.workload().imageGenerateCount(),
        plan.workload().imageEditCount(),
        plan.workload().basicMotionSeconds(),
        plan.workload().plannedI2vSeconds(),
        plan.estimatedCost(),
        Timestamp.from(plan.createdAt()));

    for (int sceneIndex = 0; sceneIndex < plan.scenes().size(); sceneIndex++) {
      var scene = plan.scenes().get(sceneIndex);
      jdbcTemplate.update(
          """
          INSERT INTO media_scene_plans (
            media_plan_id,
            scene_index,
            scene_id,
            scene_order_index,
            narration,
            duration_seconds
          ) VALUES (?, ?, ?, ?, ?, ?)
          """,
          plan.id(),
          sceneIndex,
          scene.sceneId(),
          scene.orderIndex(),
          scene.narration(),
          scene.durationSeconds());

      for (int beatIndex = 0; beatIndex < scene.beats().size(); beatIndex++) {
        var beat = scene.beats().get(beatIndex);
        jdbcTemplate.update(
            """
            INSERT INTO media_beat_plans (
              media_plan_id,
              scene_index,
              beat_index,
              visual_beat_id,
              visual_beat_order_index,
              visual_intent,
              semantic_motion_mode,
              motion_strategy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            plan.id(),
            sceneIndex,
            beatIndex,
            beat.visualBeatId(),
            beat.orderIndex(),
            beat.visualIntent(),
            beat.motionMode(),
            beat.motionStrategy().name());
      }
    }

    return plan;
  }
}
