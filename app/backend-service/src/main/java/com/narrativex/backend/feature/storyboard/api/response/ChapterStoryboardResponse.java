package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import java.util.List;

public record ChapterStoryboardResponse(ChapterItem chapter, List<SceneItem> scenes) {
  public record ChapterItem(Long id, int orderIndex, String title) {}

  public record SceneItem(
      Long id,
      int orderIndex,
      String title,
      SceneStatus status,
      int approvedBeatCount,
      int totalBeatCount,
      List<VisualBeatResponse> visualBeats) {}
}
