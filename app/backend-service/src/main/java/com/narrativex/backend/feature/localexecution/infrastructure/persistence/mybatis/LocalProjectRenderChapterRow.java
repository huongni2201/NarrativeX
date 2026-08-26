package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import java.util.UUID;

public record LocalProjectRenderChapterRow(
    UUID chapterId,
    int orderIndex,
    long globalStartMs,
    long globalEndMs,
    UUID narrationAssetId,
    String storageKey,
    long sizeBytes,
    String checksum,
    long durationMs,
    String subtitleText,
    String subtitleSpansJson) {
  public LocalProjectRenderChapterRow(
      UUID chapterId,
      int orderIndex,
      long globalStartMs,
      long globalEndMs,
      UUID narrationAssetId,
      String storageKey,
      long sizeBytes,
      String checksum,
      long durationMs) {
    this(
        chapterId,
        orderIndex,
        globalStartMs,
        globalEndMs,
        narrationAssetId,
        storageKey,
        sizeBytes,
        checksum,
        durationMs,
        "",
        null);
  }
}
