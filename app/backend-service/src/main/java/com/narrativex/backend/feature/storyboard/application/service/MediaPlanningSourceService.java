package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.BeatSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.SceneSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MediaPlanningSourceService implements MediaPlanningSourceAccess {
  private final StoryboardRepository storyboardRepository;

  @Override
  @Transactional(propagation = Propagation.MANDATORY, readOnly = true)
  public MediaPlanningSource requireCurrent(Long chapterId) {
    var scenes = storyboardRepository.findScenesByChapterId(chapterId);
    var sceneIds = scenes.stream().map(scene -> scene.getId()).toList();
    var beats = storyboardRepository.findVisualBeatsBySceneIds(sceneIds);

    Map<Long, List<VisualBeat>> beatsByScene = new HashMap<>();
    for (var beat : beats) {
      beatsByScene.computeIfAbsent(beat.getSceneId(), ignored -> new ArrayList<>()).add(beat);
    }

    var snapshots =
        scenes.stream()
            .sorted(Comparator.comparingInt(scene -> scene.getOrderIndex()))
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
                                        MotionIntent.valueOf(beat.getMotionMode().name())))
                            .toList()))
            .toList();

    return new MediaPlanningSource(snapshots);
  }
}
