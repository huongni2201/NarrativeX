package com.narrativex.backend.modules.health.application.response;

public record ProviderHealthResponse(VertexGeminiHealth vertexGemini) {
    public record VertexGeminiHealth(String status, String location, String model, boolean externalCallVerified) {
    }
}
