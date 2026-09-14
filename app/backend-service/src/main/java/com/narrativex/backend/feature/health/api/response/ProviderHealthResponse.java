package com.narrativex.backend.feature.health.api.response;

public record ProviderHealthResponse(LocalQwenHealth qwenLocal) {
  public record LocalQwenHealth(
      String status, String runtime, String model, boolean externalCallVerified) {}
}
