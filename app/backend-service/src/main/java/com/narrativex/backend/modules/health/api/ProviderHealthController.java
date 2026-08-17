package com.narrativex.backend.modules.health.api;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/provider-health")
public class ProviderHealthController {

    private final boolean vertexGeminiEnabled;
    private final String location;
    private final String model;

    public ProviderHealthController(
        @Value("${narrativex.providers.vertex-gemini.enabled:false}") boolean vertexGeminiEnabled,
        @Value("${narrativex.providers.vertex-gemini.location:us-central1}") String location,
        @Value("${narrativex.providers.vertex-gemini.model:gemini-2.5-flash}") String model) {
        this.vertexGeminiEnabled = vertexGeminiEnabled;
        this.location = location;
        this.model = model;
    }

    @GetMapping
    public Map<String, Object> get() {
        return Map.of(
            "vertexGemini", Map.of(
                "status", vertexGeminiEnabled ? "CONFIGURED_NOT_VERIFIED" : "NOT_CONFIGURED",
                "location", location,
                "model", model,
                "externalCallVerified", false));
    }
}
