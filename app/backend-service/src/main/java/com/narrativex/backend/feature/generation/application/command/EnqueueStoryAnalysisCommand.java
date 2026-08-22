package com.narrativex.backend.feature.generation.application.command;

/** Requests durable analysis for one Chapter within an owned Project. */
public record EnqueueStoryAnalysisCommand(Long projectId, Long chapterId, Long contentVariantId) {
  public EnqueueStoryAnalysisCommand(Long projectId, Long chapterId) {
    this(projectId, chapterId, null);
  }

  public EnqueueStoryAnalysisCommand {
    if (projectId == null || projectId <= 0) {
      throw new IllegalArgumentException("projectId must be positive");
    }
    if (chapterId == null || chapterId <= 0) {
      throw new IllegalArgumentException("chapterId must be positive");
    }
    if (contentVariantId != null && contentVariantId <= 0) {
      throw new IllegalArgumentException("contentVariantId must be positive");
    }
  }
}
