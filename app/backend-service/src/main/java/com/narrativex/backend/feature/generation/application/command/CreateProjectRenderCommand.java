package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateProjectRenderCommand(
    UUID projectId,
    String resolution,
    String format,
    BigDecimal maxAuthorizedCost,
    String idempotencyKey,
    List<RenderBeatOverride> beatOverrides) {

  public CreateProjectRenderCommand {
    beatOverrides = beatOverrides == null ? List.of() : List.copyOf(beatOverrides);
  }

  public CreateProjectRenderCommand(
      UUID projectId,
      String resolution,
      String format,
      BigDecimal maxAuthorizedCost,
      String idempotencyKey) {
    this(projectId, resolution, format, maxAuthorizedCost, idempotencyKey, List.of());
  }
}
