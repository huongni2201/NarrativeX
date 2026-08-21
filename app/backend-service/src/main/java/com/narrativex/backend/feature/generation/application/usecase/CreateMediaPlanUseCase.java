package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.service.MotionStrategyResolver;
import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.value.MediaBeatPlan;
import com.narrativex.backend.feature.generation.domain.value.MediaScenePlan;
import com.narrativex.backend.feature.generation.domain.value.MediaWorkload;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Backend authority that snapshots and authorizes one immutable media execution plan. */
@Service
@RequiredArgsConstructor
public class CreateMediaPlanUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterAnalysisSourceAccess chapterAnalysisSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final MediaPlanRepository mediaPlanRepository;
  private final MotionStrategyResolver motionStrategyResolver;

  @Transactional
  public MediaPlan execute(CreateMediaPlanCommand command) {
    String userId = currentUserId.get();

    // Reuse the ownership-scoped Chapter serialization boundary. The lock stays held while the
    // current storyboard is snapshotted and the revision is allocated.
    var chapter =
        chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(
            command.projectId(), command.chapterId(), userId);

    var planningSource = mediaPlanningSourceAccess.requireCurrent(command.chapterId());
    if (planningSource.sourceHash() != null
        && !planningSource.sourceHash().equals(chapter.sourceHash())) {
      throw new GenerationAdmissionDeniedException(
          "SOURCE_STALE", "The storyboard source is stale; refresh the chapter before generating.");
    }
    var scenes = resolveScenes(command, planningSource);
    if (scenes.isEmpty() || scenes.stream().allMatch(scene -> scene.beats().isEmpty())) {
      throw new GenerationAdmissionDeniedException(
          "STORYBOARD_NOT_READY", "The current storyboard has no visual beats ready for generation.");
    }
    if (command.productionMode().name().equals("IMAGE_MOTION")
        && planningSource.scenes().stream()
            .flatMap(scene -> scene.beats().stream())
            .anyMatch(beat -> !"APPROVED".equals(beat.reviewStatus()))) {
      throw new GenerationAdmissionDeniedException(
          "STORYBOARD_NOT_READY", "Every visual beat must be approved before image generation.");
    }
    var workload = calculateWorkload(scenes);
    int revision = mediaPlanRepository.nextRevision(command.chapterId());

    return mediaPlanRepository.save(
        MediaPlan.createExecutable(
            command.chapterId(),
            chapter.rowVersion(),
            chapter.sourceHash(),
            command.productionMode(),
            revision,
            scenes,
            workload,
            command.estimatedCost(),
            java.time.Instant.now(),
            planningSource.storyboardRevisionId(),
            command.imageAspectRatio(),
            command.imageQualityTier(),
            command.imageProviderKey(),
            command.imageModelKey(),
            command.pricingSnapshotJson(),
            command.pricingFingerprint(),
            planningSource.narrationSetId(),
            planningSource.narrationAlignmentRunId()));
  }

  private List<MediaScenePlan> resolveScenes(
      CreateMediaPlanCommand command, MediaPlanningSource planningSource) {
    return planningSource.scenes().stream()
        .map(
            scene ->
                new MediaScenePlan(
                    scene.sceneId(),
                    scene.orderIndex(),
                    scene.narration(),
                    scene.durationSeconds(),
                    scene.beats().stream()
                        .map(
                            beat ->
                                new MediaBeatPlan(
                                    beat.visualBeatId(),
                                    beat.orderIndex(),
                                    beat.visualIntent(),
                                    beat.motionIntent().name(),
                                    motionStrategyResolver.resolve(
                                        command.productionMode(), beat.motionIntent()),
                                    "GENERATE_NEW",
                                    "prompt-v1",
                                    beat.visualIntent(),
                                    null,
                                    beat.audioStartMs(),
                                    beat.audioEndMs(),
                                    beat.audioStartMs() != null && beat.audioEndMs() != null
                                        ? beat.audioEndMs() - beat.audioStartMs()
                                        : null,
                                    beat.cameraMovement(),
                                    "{\"aspectRatio\":\""
                                        + (beat.aspectRatioOverride() == null
                                            ? command.imageAspectRatio()
                                            : beat.aspectRatioOverride())
                                        + "\",\"qualityTier\":\""
                                        + (beat.qualityTierOverride() == null
                                            ? command.imageQualityTier()
                                            : beat.qualityTierOverride())
                                        + "\"}",
                                    "{}",
                                    null))
                        .toList()))
        .toList();
  }

  /**
   * Phase-1 workload accounting intentionally uses only information already authoritative in the
   * storyboard snapshot. Image edits remain zero until edit operations become first-class plans. A
   * scene's duration is attributed to I2V when any beat in that scene requires I2V; otherwise it is
   * attributed to basic image motion.
   */
  private static MediaWorkload calculateWorkload(List<MediaScenePlan> scenes) {
    long narrationCharacters = 0L;
    int imageGenerateCount = 0;
    int basicMotionSeconds = 0;
    int plannedI2vSeconds = 0;

    for (var scene : scenes) {
      if (scene.narration() != null) {
        narrationCharacters += scene.narration().length();
      }
      imageGenerateCount += scene.beats().size();

      int duration = scene.durationSeconds() == null ? 0 : scene.durationSeconds();
      boolean usesI2v =
          scene.beats().stream()
              .anyMatch(beat -> beat.motionStrategy() == MotionStrategy.IMAGE_TO_VIDEO);
      if (usesI2v) {
        plannedI2vSeconds += duration;
      } else {
        basicMotionSeconds += duration;
      }
    }

    return new MediaWorkload(
        narrationCharacters, imageGenerateCount, 0, basicMotionSeconds, plannedI2vSeconds);
  }
}
