package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaBeatPlanRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaPlanMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaPlanRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaScenePlanRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisMediaPlanPersistenceAdapter implements MediaPlanRepository {
  private final MediaPlanMapper mapper;

  @Override
  public int nextRevision(Long chapterId) {
    Integer next = mapper.nextRevision(chapterId);
    if (next == null || next <= 0) {
      throw new IllegalStateException(
          "Could not allocate media plan revision for chapter " + chapterId);
    }
    return next;
  }

  @Override
  public MediaPlan save(MediaPlan plan) {
    mapper.insertPlan(
        new MediaPlanRow(
            plan.id(),
            plan.chapterId(),
            plan.chapterRowVersion(),
            plan.sourceHash(),
            plan.productionMode(),
            plan.revision(),
            plan.workload().narrationCharacters(),
            plan.workload().imageGenerateCount(),
            plan.workload().imageEditCount(),
            plan.workload().basicMotionSeconds(),
            plan.workload().plannedI2vSeconds(),
            plan.estimatedCost(),
            plan.createdAt()));
    for (int sceneIndex = 0; sceneIndex < plan.scenes().size(); sceneIndex++) {
      var scene = plan.scenes().get(sceneIndex);
      mapper.insertScene(
          new MediaScenePlanRow(
              plan.id(),
              sceneIndex,
              scene.sceneId(),
              scene.orderIndex(),
              scene.narration(),
              scene.durationSeconds()));
      for (int beatIndex = 0; beatIndex < scene.beats().size(); beatIndex++) {
        var beat = scene.beats().get(beatIndex);
        mapper.insertBeat(
            new MediaBeatPlanRow(
                plan.id(),
                sceneIndex,
                beatIndex,
                beat.visualBeatId(),
                beat.orderIndex(),
                beat.visualIntent(),
                beat.motionMode(),
                beat.motionStrategy()));
      }
    }
    return plan;
  }
}
