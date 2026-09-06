package com.narrativex.backend.feature.generation.domain.value;

import java.util.UUID;

/** Read-only progress derived from durable analysis checkpoints and continuity reports. */
public record AnalysisProgress(
    String phase,
    int completedShards,
    int totalShards,
    int reusedShards,
    int repairCount,
    UUID continuityReportId,
    String pipelineVersion) {
  public AnalysisProgress {
    if (completedShards < 0 || totalShards < 0 || reusedShards < 0 || repairCount < 0) {
      throw new IllegalArgumentException("analysis progress counts must not be negative");
    }
    if (completedShards > totalShards) {
      throw new IllegalArgumentException("completedShards must not exceed totalShards");
    }
    if (reusedShards > completedShards) {
      throw new IllegalArgumentException("reusedShards must not exceed completedShards");
    }
  }
}
