package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StoryboardRepository {
  List<Scene> findScenesByChapterId(UUID chapterId);

  List<VisualBeat> findVisualBeatsBySceneIds(List<UUID> sceneIds);

  Optional<Scene> findSceneById(UUID sceneId);

  Optional<Scene> findSceneByIdForUpdate(UUID sceneId, UUID chapterId);

  Optional<VisualBeat> findVisualBeatById(UUID visualBeatId);

  int nextVisualBeatOrderIndex(UUID sceneId);

  VisualBeat saveVisualBeat(VisualBeat visualBeat);
}
