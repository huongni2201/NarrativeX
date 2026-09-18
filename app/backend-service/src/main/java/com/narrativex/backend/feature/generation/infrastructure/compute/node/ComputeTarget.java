package com.narrativex.backend.feature.generation.infrastructure.compute.node;

import java.time.Instant;
import java.util.Set;

public record ComputeTarget(
    String id,
    String name,
    String baseUrl,
    String machineToken,
    ComputeTargetStatus status,
    Set<String> supportedExecutors,
    Instant lastHeartbeatAt) {

  public boolean isReady() {
    return status == ComputeTargetStatus.ONLINE;
  }
}
