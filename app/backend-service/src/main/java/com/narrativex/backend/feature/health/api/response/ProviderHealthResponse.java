package com.narrativex.backend.feature.health.api.response;

public record ProviderHealthResponse(VertexGeminiHealth vertexGemini) {
  public record VertexGeminiHealth(
      String status, String model, String location, boolean configured) {}
}
