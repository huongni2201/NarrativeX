package com.narrativex.backend.feature.generation.application.query;

import java.util.List;
import java.util.UUID;

/** Project-level production timeline on one global audio clock. */
public record ProductionTimelineView(
    UUID projectId,
    UUID storyVersionId,
    long totalDurationMs,
    String aspectRatio,
    boolean readyForRender,
    List<Chapter> chapters,
    List<Beat> beats) {

  public record Chapter(
      UUID chapterId,
      int orderIndex,
      String title,
      long rowVersion,
      String sourceHash,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      long startMs,
      long endMs,
      Long audioDurationMs,
      String audioStorageKey,
      Long audioSizeBytes,
      String audioChecksum,
      UUID narrationRequestId,
      UUID narrationAssetId,
      UUID narrationAlignmentId,
      int beatCount,
      int readyBeatCount,
      boolean readyForRender) {}

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
      String storageKey,
      Long sizeBytes,
      String checksum,
      long startMs,
      long endMs,
      long durationMs,
      boolean assetReady) {
    public Beat(
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
        String storageKey,
        Long sizeBytes,
        String checksum,
        long startMs,
        long endMs,
        long durationMs,
        boolean assetReady) {
      this(
          chapterId,
          chapterOrderIndex,
          sceneIndex,
          beatIndex,
          visualBeatId,
          title,
          visualIntent,
          cameraMovement,
          assetStrategy,
          mediaAssetId,
          mediaAssetId == null ? null : "IMAGE",
          null,
          "TRIM",
          0L,
          false,
          storageKey,
          sizeBytes,
          checksum,
          startMs,
          endMs,
          durationMs,
          assetReady);
    }
  }
}
