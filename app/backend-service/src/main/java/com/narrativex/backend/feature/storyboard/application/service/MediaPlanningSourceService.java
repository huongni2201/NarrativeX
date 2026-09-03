package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.BeatSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.SceneSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MediaPlanningSourceService implements MediaPlanningSourceAccess {
  private final StoryboardRepository storyboardRepository;
  private final StoryboardRevisionAccess storyboardRevisionAccess;

  @Override
  @Transactional(propagation = Propagation.MANDATORY, readOnly = true)
  public MediaPlanningSource requireCurrent(UUID chapterId) {
    List<Scene> scenes = storyboardRepository.findScenesByChapterId(chapterId);
    List<UUID> sceneIds = scenes.stream().map(Scene::getId).toList();
    List<VisualBeat> beats = storyboardRepository.findVisualBeatsBySceneIds(sceneIds);

    Map<UUID, List<VisualBeat>> beatsByScene = new HashMap<>();
    for (VisualBeat beat : beats) {
      beatsByScene.computeIfAbsent(beat.getSceneId(), ignored -> new ArrayList<>()).add(beat);
    }

    var snapshots =
        scenes.stream()
            .sorted(Comparator.comparingInt(Scene::getOrderIndex))
            .map(
                scene ->
                    new SceneSnapshot(
                        scene.getId(),
                        scene.getOrderIndex(),
                        scene.getNarration(),
                        scene.getDurationSeconds(),
                        beatsByScene.getOrDefault(scene.getId(), List.of()).stream()
                            .sorted(Comparator.comparingInt(VisualBeat::getOrderIndex))
                            .map(
                                beat ->
                                    new BeatSnapshot(
                                        beat.getId(),
                                        beat.getOrderIndex(),
                                        beat.getVisualIntent(),
                                        MotionIntent.valueOf(beat.getMotionMode().name()),
                                        beat.getReviewStatus().name(),
                                        beat.getCameraMovement().name(),
                                        beat.getCameraAngle().name(),
                                        beat.getAspectRatioOverride() == null
                                            ? null
                                            : beat.getAspectRatioOverride().getCode(),
                                        beat.getQualityTierOverride() == null
                                            ? null
                                            : beat.getQualityTierOverride().name(),
                                        null,
                                        null,
                                        beat.getVisualDirectionJson()))
                            .toList()))
            .toList();

    var revision = storyboardRevisionAccess.current(chapterId);
    return new MediaPlanningSource(
        snapshots, revision.revisionId(), revision.sourceHash(), null, null);
  }
}
