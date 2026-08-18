package com.narrativex.backend.feature.generation.application.command;

/** Requests durable analysis for one Chapter within an owned Project. */
public record EnqueueStoryAnalysisCommand(Long projectId, Long chapterId) {
  public EnqueueStoryAnalysisCommand {
    if (projectId == null || projectId <= 0) {
      throw new IllegalArgumentException("projectId must be positive");
    }
    if (chapterId == null || chapterId <= 0) {
      throw new IllegalArgumentException("chapterId must be positive");
    }
  }
}
