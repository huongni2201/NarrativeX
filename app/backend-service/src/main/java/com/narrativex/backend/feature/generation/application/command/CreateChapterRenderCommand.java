package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateChapterRenderCommand(
    UUID projectId,
    UUID chapterId,
    String resolution,
    String format,
    UUID mediaPlanId,
    Integer mediaPlanRevision,
    BigDecimal maxAuthorizedCost,
    String idempotencyKey) {
  public CreateChapterRenderCommand(
      UUID projectId, UUID chapterId, String resolution, String format) {
    this(projectId, chapterId, resolution, format, null, null, null, null);
  }
}
