package com.narrativex.backend.feature.storyboard.api.response;

import java.util.List;
import java.util.UUID;

public record ChapterStoryResponse(
    UUID chapterId,
    String chapterTitle,
    int chapterOrderIndex,
    UUID storyboardRevisionId,
    List<StorySceneItem> scenes) {

  public record StorySceneItem(
      UUID id,
      UUID chapterId,
      int orderIndex,
      String title,
      String status,
      String summary,
      String mood,
      String lighting,
      String timeOfDay,
      String locationText,
      UUID projectLocationId,
      List<StoryBeatItem> storyBeats,
      int approvedBeatCount,
      int totalBeatCount) {}

  public record StoryBeatItem(
      UUID id,
      UUID sceneId,
      int orderIndex,
      String title,
      String purpose,
      String summary,
      String importance,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      String storyFunctionsJson,
      String continuityStateJson,
      String reviewStatus,
      List<AudioCueItem> audioCues,
      List<VisualBeatItem> visualBeats,
      BeatTiming timing,
      long rowVersion,
      String persistenceState) {}

  public record AudioCueItem(
      UUID id,
      UUID storyBeatId,
      int orderIndex,
      String cueType,
      UUID speakerProjectCharacterId,
      Integer sourceStart,
      Integer sourceEnd,
      String adaptationAction,
      String adaptedText,
      String deliveryHint,
      Integer narrationTextStart,
      Integer narrationTextEnd,
      Long audioStartMs,
      Long audioEndMs,
      String status,
      long rowVersion) {}

  public record VisualBeatItem(
      UUID id,
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String visualSummary,
      String visualDescription,
      String visualDirectionJson,
      String reviewStatus,
      String motionMode,
      double relativeWeight,
      String visualFocus,
      String aspectRatioOverride,
      Integer textStart,
      Integer textEnd,
      String sourceAnchorJson,
      UUID previewMediaAssetId,
      String prompt,
      long rowVersion) {}

  public record BeatTiming(Long startMs, Long endMs, Long durationMs) {}
}
