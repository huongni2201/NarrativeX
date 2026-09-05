package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.domain.value.MediaBeatPlan;
import com.narrativex.backend.feature.generation.domain.value.MediaScenePlan;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Compiles immutable scene/beat media snapshots without owning admission or persistence. */
@Component
@RequiredArgsConstructor
public final class MediaPlanSceneResolver {
  private static final String GENERATE_NEW = "GENERATE_NEW";
  private static final String PROMPT_CONTRACT = "structured-visual-prompt";

  private final MotionStrategyResolver motionStrategyResolver;
  private final VisualPromptContextRepository visualPromptContextRepository;
  private final VisualPromptComposer visualPromptComposer;

  public List<MediaScenePlan> resolve(
      CreateMediaPlanCommand command, MediaPlanningSource planningSource) {
    Set<UUID> includedBeatIds = command.includedBeatIds();
    boolean includeAll = includedBeatIds.isEmpty();
    List<MediaScenePlan> resolved = new ArrayList<>();

    for (var scene : planningSource.scenes()) {
      List<MediaBeatPlan> beats = new ArrayList<>();
      for (var beat : scene.beats()) {
        if (!includeAll && !includedBeatIds.contains(beat.visualBeatId())) continue;

        var context =
            visualPromptContextRepository.findForBeat(command.projectId(), beat.visualBeatId());
        String aspectRatio =
            beat.aspectRatioOverride() == null
                ? command.imageAspectRatio()
                : beat.aspectRatioOverride();
        var composed =
            visualPromptComposer.compose(
                command.imageStyle(),
                beat.visualIntent(),
                beat.visualDirectionJson(),
                aspectRatio,
                context);
        String cameraMovement =
            beat.cameraMovement() == null || beat.cameraMovement().isBlank()
                ? "NONE"
                : beat.cameraMovement();
        beats.add(
            new MediaBeatPlan(
                beat.visualBeatId(),
                beat.orderIndex(),
                beat.visualIntent(),
                beat.motionIntent().name(),
                motionStrategyResolver.resolve(command.productionMode(), beat.motionIntent()),
                GENERATE_NEW,
                PROMPT_CONTRACT + "-" + command.imageStyle().name().toLowerCase(),
                composed.prompt(),
                composed.negativePrompt(),
                beat.audioStartMs(),
                beat.audioEndMs(),
                beat.audioStartMs() != null && beat.audioEndMs() != null
                    ? beat.audioEndMs() - beat.audioStartMs()
                    : null,
                cameraMovement,
                renderSettingsJson(command, beat, aspectRatio),
                composed.characterSnapshotJson(),
                null,
                null));
      }
      if (!beats.isEmpty()) {
        resolved.add(
            new MediaScenePlan(
                scene.sceneId(),
                scene.orderIndex(),
                scene.narration(),
                scene.durationSeconds(),
                beats));
      }
    }
    return List.copyOf(resolved);
  }

  public boolean allSelectedBeatsApproved(
      CreateMediaPlanCommand command, MediaPlanningSource planningSource) {
    Set<UUID> includedBeatIds = command.includedBeatIds();
    boolean includeAll = includedBeatIds.isEmpty();
    return planningSource.scenes().stream()
        .flatMap(scene -> scene.beats().stream())
        .filter(beat -> includeAll || includedBeatIds.contains(beat.visualBeatId()))
        .allMatch(beat -> "APPROVED".equals(beat.reviewStatus()));
  }

  private static String renderSettingsJson(
      CreateMediaPlanCommand command, MediaPlanningSource.BeatSnapshot beat, String aspectRatio) {
    String direction = beat.visualDirectionJson();
    return "{\"aspectRatio\":\""
        + aspectRatio
        + "\",\"visualStyle\":\""
        + command.imageStyle().name()
        + "\",\"cameraAngle\":\""
        + beat.cameraAngle()
        + "\",\"visualDirection\":"
        + (direction == null ? "null" : direction)
        + "}";
  }
}
