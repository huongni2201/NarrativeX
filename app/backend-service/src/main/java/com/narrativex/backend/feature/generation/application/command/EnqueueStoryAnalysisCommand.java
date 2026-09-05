package com.narrativex.backend.feature.generation.application.command;

import java.util.UUID;

/** Requests durable analysis for one Chapter within an owned Project. */
public record EnqueueStoryAnalysisCommand(
    UUID projectId,
    UUID chapterId,
    String visualGenerationMode,
    String imageProvider,
    String idempotencyKey) {

  public EnqueueStoryAnalysisCommand(UUID projectId, UUID chapterId) {
    this(projectId, chapterId, "IMAGE", "API", null);
  }

  public EnqueueStoryAnalysisCommand(
      UUID projectId, UUID chapterId, String visualGenerationMode, String imageProvider) {
    this(projectId, chapterId, visualGenerationMode, imageProvider, null);
  }

  public EnqueueStoryAnalysisCommand {
    if (projectId == null) throw new IllegalArgumentException("projectId must not be null");
    if (chapterId == null) throw new IllegalArgumentException("chapterId must not be null");
    if (!"IMAGE".equals(visualGenerationMode) && !"VIDEO".equals(visualGenerationMode)) {
      throw new IllegalArgumentException("visualGenerationMode must be IMAGE or VIDEO");
    }
    if ("IMAGE".equals(visualGenerationMode)) {
      if (!"GEMINI_WEB".equals(imageProvider) && !"API".equals(imageProvider)) {
        throw new IllegalArgumentException(
            "imageProvider must be GEMINI_WEB or API for IMAGE mode");
      }
    } else {
      imageProvider = null;
    }
    if (idempotencyKey != null) {
      idempotencyKey = idempotencyKey.trim();
      if (idempotencyKey.isEmpty() || idempotencyKey.length() > 200) {
        throw new IllegalArgumentException("idempotencyKey must contain 1-200 characters");
      }
    }
  }
}
