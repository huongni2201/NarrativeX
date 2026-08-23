package com.narrativex.backend.feature.generation.application.command;

import java.util.Objects;
import java.util.UUID;

/** Requests durable analysis for one Chapter within an owned Project. */
public record EnqueueStoryAnalysisCommand(UUID projectId, UUID chapterId, UUID contentVariantId) {
  public EnqueueStoryAnalysisCommand(UUID projectId, UUID chapterId) {
    this(projectId, chapterId, null);
  }

  public EnqueueStoryAnalysisCommand {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(chapterId, "chapterId must not be null");
  }
}
