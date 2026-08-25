package com.narrativex.backend.feature.generation.application.command;

import java.util.UUID;

/** Requests durable analysis for one Chapter within an owned Project. */
public record EnqueueStoryAnalysisCommand(UUID projectId, UUID chapterId, UUID contentVariantId) {
  public EnqueueStoryAnalysisCommand(UUID projectId, UUID chapterId) {
    this(projectId, chapterId, null);
  }

  public EnqueueStoryAnalysisCommand {
    if (projectId == null) throw new IllegalArgumentException("projectId must not be null");
    if (chapterId == null) throw new IllegalArgumentException("chapterId must not be null");
  }
}
