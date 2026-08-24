package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateChapterRenderCommand(
    UUID projectId,
    UUID chapterId,
    String resolution,
    String format,
    UUID mediaPlanId,
    Integer mediaPlanRevision,
    BigDecimal maxAuthorizedCost,
    String idempotencyKey,
    List<RenderBeatOverride> beatOverrides) {

  public CreateChapterRenderCommand {
    beatOverrides = beatOverrides == null ? List.of() : List.copyOf(beatOverrides);
  }

  public CreateChapterRenderCommand(
      UUID projectId,
      UUID chapterId,
      String resolution,
      String format,
      UUID mediaPlanId,
      Integer mediaPlanRevision,
      BigDecimal maxAuthorizedCost,
      String idempotencyKey) {
    this(
        projectId,
        chapterId,
        resolution,
        format,
        mediaPlanId,
        mediaPlanRevision,
        maxAuthorizedCost,
        idempotencyKey,
        List.of());
  }

  public CreateChapterRenderCommand(
      UUID projectId, UUID chapterId, String resolution, String format) {
    this(projectId, chapterId, resolution, format, null, null, null, null, List.of());
  }
}
