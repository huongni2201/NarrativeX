package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import java.util.List;
import java.util.UUID;

public record ProductionTimelineResponse(
    UUID projectId,
    UUID storyVersionId,
    long totalDurationMs,
    String aspectRatio,
    boolean readyForRender,
    List<Chapter> chapters,
    List<Beat> beats) {

  public static ProductionTimelineResponse from(ProductionTimelineView view) {
    return new ProductionTimelineResponse(
        view.projectId(),
        view.storyVersionId(),
        view.totalDurationMs(),
        view.aspectRatio(),
        view.readyForRender(),
        view.chapters().stream().map(Chapter::from).toList(),
        view.beats().stream().map(Beat::from).toList());
  }

  public record Chapter(
      UUID chapterId,
      int orderIndex,
      String title,
      long startMs,
      long endMs,
      Long audioDurationMs,
      int beatCount,
      int readyBeatCount,
      boolean audioReady,
      boolean readyForRender) {
    static Chapter from(ProductionTimelineView.Chapter chapter) {
      return new Chapter(
          chapter.chapterId(),
          chapter.orderIndex(),
          chapter.title(),
          chapter.startMs(),
          chapter.endMs(),
          chapter.audioDurationMs(),
          chapter.beatCount(),
          chapter.readyBeatCount(),
          chapter.audioStorageKey() != null
              && !chapter.audioStorageKey().isBlank()
              && chapter.audioDurationMs() != null
              && chapter.audioDurationMs() > 0,
          chapter.readyForRender());
    }
  }

  public record Beat(
      UUID chapterId,
      int chapterOrderIndex,
      int sceneIndex,
      int beatIndex,
      UUID visualBeatId,
      String title,
      String visualIntent,
      String cameraMovement,
      String assetStrategy,
      UUID mediaAssetId,
      long startMs,
      long endMs,
      long durationMs,
      boolean assetReady) {
    static Beat from(ProductionTimelineView.Beat beat) {
      return new Beat(
          beat.chapterId(),
          beat.chapterOrderIndex(),
          beat.sceneIndex(),
          beat.beatIndex(),
          beat.visualBeatId(),
          beat.title(),
          beat.visualIntent(),
          beat.cameraMovement(),
          beat.assetStrategy(),
          beat.mediaAssetId(),
          beat.startMs(),
          beat.endMs(),
          beat.durationMs(),
          beat.assetReady());
    }
  }
}
