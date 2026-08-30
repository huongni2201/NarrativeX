package com.narrativex.backend.feature.generation.application.command;

import java.util.List;
import java.util.UUID;

public record CreateProjectRenderCommand(
    UUID projectId,
    String resolution,
    String format,
    String idempotencyKey,
    UUID localDeviceId,
    boolean subtitlesEnabled,
    List<RenderBeatOverride> beatOverrides) {

  public CreateProjectRenderCommand {
    beatOverrides = beatOverrides == null ? List.of() : List.copyOf(beatOverrides);
  }

  public CreateProjectRenderCommand(
      UUID projectId,
      String resolution,
      String format,
      String idempotencyKey,
      UUID localDeviceId,
      List<RenderBeatOverride> beatOverrides) {
    this(projectId, resolution, format, idempotencyKey, localDeviceId, true, beatOverrides);
  }
}
