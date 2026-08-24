package com.narrativex.backend.feature.generation.application.command;

import com.narrativex.backend.feature.generation.domain.enums.RenderExecutionTarget;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateProjectRenderCommand(
    UUID projectId,
    String resolution,
    String format,
    BigDecimal maxAuthorizedCost,
    String idempotencyKey,
    RenderExecutionTarget executionTarget,
    UUID localDeviceId,
    List<RenderBeatOverride> beatOverrides) {

  public CreateProjectRenderCommand {
    executionTarget = executionTarget == null ? RenderExecutionTarget.CLOUD : executionTarget;
    beatOverrides = beatOverrides == null ? List.of() : List.copyOf(beatOverrides);
  }

  public CreateProjectRenderCommand(
      UUID projectId,
      String resolution,
      String format,
      BigDecimal maxAuthorizedCost,
      String idempotencyKey) {
    this(
        projectId,
        resolution,
        format,
        maxAuthorizedCost,
        idempotencyKey,
        RenderExecutionTarget.CLOUD,
        null,
        List.of());
  }

  public CreateProjectRenderCommand(
      UUID projectId,
      String resolution,
      String format,
      BigDecimal maxAuthorizedCost,
      String idempotencyKey,
      List<RenderBeatOverride> beatOverrides) {
    this(
        projectId,
        resolution,
        format,
        maxAuthorizedCost,
        idempotencyKey,
        RenderExecutionTarget.CLOUD,
        null,
        beatOverrides);
  }
}
