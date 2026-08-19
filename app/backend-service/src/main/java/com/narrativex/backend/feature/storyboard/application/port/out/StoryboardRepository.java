package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.List;
import java.util.Optional;

public interface StoryboardRepository {
  List<Scene> findScenesByChapterId(Long chapterId);

  List<VisualBeat> findVisualBeatsBySceneIds(List<Long> sceneIds);

  Optional<Scene> findSceneById(Long sceneId);

  Optional<Scene> findSceneByIdForUpdate(Long sceneId, Long chapterId);

  Optional<VisualBeat> findVisualBeatById(Long visualBeatId);

  int nextVisualBeatOrderIndex(Long sceneId);

  VisualBeat saveVisualBeat(VisualBeat visualBeat);
}
