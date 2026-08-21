package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaBeatPlanRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaPlanMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaPlanRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaScenePlanRow;
import lombok.RequiredArgsConstructor;
import java.util.UUID;
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
            plan.createdAt(),
            plan.storyboardRevisionId(),
            plan.workflowVersion(),
            plan.imageAspectRatio(),
            plan.imageQualityTier(),
            plan.imageProviderKey(),
            plan.imageModelKey(),
            plan.pricingSnapshotJson(),
            plan.pricingFingerprint(),
            plan.narrationSetId(),
            plan.narrationAlignmentRunId()));
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
                beat.motionStrategy(),
                beat.assetStrategy(),
                beat.promptTemplateVersion(),
                beat.promptSnapshot(),
                beat.negativePrompt(),
                beat.audioStartMs(),
                beat.audioEndMs(),
                beat.audioDurationMs(),
                beat.cameraMovement(),
                beat.imageSettingsJson(),
                beat.characterSnapshotJson(),
                beat.snapshotFingerprint()));
      }
    }
    return plan;
  }

  @Override
  public boolean existsOwnedForChapter(UUID mediaPlanId, int revision, Long chapterId, String ownerId) {
    return mapper.existsOwnedForChapter(mediaPlanId, revision, chapterId, ownerId);
  }
}
