package com.narrativex.backend.feature.storyboard.api.response;

import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import java.util.List;
import java.util.UUID;

public record ChapterStoryboardResponse(ChapterItem chapter, List<SceneItem> scenes) {
  public record ChapterItem(UUID id, int orderIndex, String title) {}

  public record SceneItem(
      UUID id,
      int orderIndex,
      String title,
      SceneStatus status,
      int approvedBeatCount,
      int totalBeatCount,
      List<VisualBeatResponse> visualBeats) {}
}
