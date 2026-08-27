package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.util.UUID;

/** Requests durable analysis for one Chapter within an owned Project. */
public record EnqueueStoryAnalysisCommand(
    UUID projectId, UUID chapterId, ProductionMode productionMode) {
  public EnqueueStoryAnalysisCommand(UUID projectId, UUID chapterId) {
    this(projectId, chapterId, ProductionMode.IMAGE_MOTION);
  }

  public EnqueueStoryAnalysisCommand {
    if (projectId == null) throw new IllegalArgumentException("projectId must not be null");
    if (chapterId == null) throw new IllegalArgumentException("chapterId must not be null");
    if (productionMode == null) productionMode = ProductionMode.IMAGE_MOTION;
    if (productionMode == ProductionMode.HYBRID_LOCAL_I2V) {
      throw new IllegalArgumentException(
          "HYBRID_LOCAL_I2V is a media-plan mode and cannot direct chapter analysis");
    }
  }
}
