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
      UUID narrationAssetId,
      Long audioSizeBytes,
      String audioChecksum,
      int beatCount,
      int readyBeatCount,
      boolean audioReady,
      boolean readyForRender) {
    static Chapter from(ProductionTimelineView.Chapter chapter) {
      boolean audioReady =
          chapter.audioStorageKey() != null
              && !chapter.audioStorageKey().isBlank()
              && chapter.audioDurationMs() != null
              && chapter.audioDurationMs() > 0
              && chapter.audioSizeBytes() != null
              && chapter.audioSizeBytes() > 0
              && chapter.audioChecksum() != null
              && !chapter.audioChecksum().isBlank();
      return new Chapter(
          chapter.chapterId(),
          chapter.orderIndex(),
          chapter.title(),
          chapter.startMs(),
          chapter.endMs(),
          chapter.audioDurationMs(),
          chapter.narrationAssetId(),
          chapter.audioSizeBytes(),
          chapter.audioChecksum(),
          chapter.beatCount(),
          chapter.readyBeatCount(),
          audioReady,
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
      String mediaType,
      Long sourceDurationMs,
      String fitMode,
      long trimStartMs,
      boolean mediaSelectionActive,
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
          beat.mediaType(),
          beat.sourceDurationMs(),
          beat.fitMode(),
          beat.trimStartMs(),
          beat.mediaSelectionActive(),
          beat.startMs(),
          beat.endMs(),
          beat.durationMs(),
          beat.assetReady());
    }
  }
}
