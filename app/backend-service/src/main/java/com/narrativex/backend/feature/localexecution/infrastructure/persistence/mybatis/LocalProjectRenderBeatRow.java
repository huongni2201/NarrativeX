package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.util.UUID;

public record LocalProjectRenderBeatRow(
    UUID chapterId,
    int sceneIndex,
    int beatIndex,
    UUID visualBeatId,
    UUID mediaAssetId,
    long globalStartMs,
    long globalEndMs,
    long durationMs,
    String cameraMovement,
    String storageKey,
    long sizeBytes,
    String checksum,
    UUID cutId,
    UUID shotId,
    UUID takeId,
    Long sourceOutMs,
    String subtitleWordsJson) {
  public LocalProjectRenderBeatRow(
      UUID chapterId,
      int sceneIndex,
      int beatIndex,
      UUID visualBeatId,
      UUID mediaAssetId,
      long globalStartMs,
      long globalEndMs,
      long durationMs,
      String cameraMovement,
      String storageKey,
      long sizeBytes,
      String checksum) {
    this(
        chapterId,
        sceneIndex,
        beatIndex,
        visualBeatId,
        mediaAssetId,
        globalStartMs,
        globalEndMs,
        durationMs,
        cameraMovement,
        storageKey,
        sizeBytes,
        checksum,
        visualBeatId,
        null,
        null,
        null,
        null);
  }
}
