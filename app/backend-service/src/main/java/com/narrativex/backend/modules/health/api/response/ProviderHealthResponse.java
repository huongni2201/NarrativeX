package com.narrativex.backend.modules.health.api.response;

/** Provider configuration state; CONFIGURED_NOT_VERIFIED is never reported as a successful probe. */
public record ProviderHealthResponse(VertexGeminiHealth vertexGemini) {

    public record VertexGeminiHealth(
        String status,
        String location,
        String model,
        boolean externalCallVerified
    ) {
    }
}
