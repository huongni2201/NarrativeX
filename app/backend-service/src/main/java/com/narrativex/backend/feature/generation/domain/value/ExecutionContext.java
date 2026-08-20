package com.narrativex.backend.feature.generation.domain.value;

public record ExecutionContext(
    boolean providerAvailable,
    boolean providerTimedOut,
    boolean gpuCapacityAvailable,
    boolean quotaAvailable,
    boolean withinCostLimit,
    int previousAttempts,
    int maxAttempts) {
  public ExecutionContext {
    if (previousAttempts < 0) throw new IllegalArgumentException("previousAttempts must not be negative");
    if (maxAttempts < 0) throw new IllegalArgumentException("maxAttempts must not be negative");
  }

  public static ExecutionContext mvp() {
    return new ExecutionContext(true, false, true, true, true, 0, Integer.MAX_VALUE);
  }
}
