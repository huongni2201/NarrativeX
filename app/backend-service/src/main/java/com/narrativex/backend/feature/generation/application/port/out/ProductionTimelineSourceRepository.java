package com.narrativex.backend.feature.generation.application.port.out;

import java.util.List;
import java.util.UUID;

public interface ProductionTimelineSourceRepository {
  List<ChapterSource> findChapters(UUID projectId, String ownerId);

  List<BeatSource> findBeats(UUID projectId, String ownerId);

  record ChapterSource(
      UUID storyVersionId,
      UUID chapterId,
      int orderIndex,
      String title,
      long rowVersion,
      String sourceHash,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      String aspectRatio,
      Long audioDurationMs,
      String audioStorageKey,
      Long audioSizeBytes,
      String audioChecksum,
      UUID narrationRequestId,
      UUID narrationAssetId,
      UUID narrationAlignmentId,
      String subtitleText,
      String subtitleSpansJson,
      Long fallbackDurationMs,
      int beatCount,
      int readyBeatCount) {}

  record BeatSource(
      UUID chapterId,
      int chapterOrderIndex,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      int sceneIndex,
      int beatIndex,
      UUID visualBeatId,
      String title,
      String visualIntent,
      String cameraMovement,
      String assetStrategy,
      Long audioStartMs,
      Long audioEndMs,
      Long audioDurationMs,
      UUID mediaAssetId,
      String mediaType,
      String storageMode,
      Long sourceDurationMs,
      String fitMode,
      long trimStartMs,
      boolean mediaSelectionActive,
      String storageKey,
      Long sizeBytes,
      String checksum) {}
}
