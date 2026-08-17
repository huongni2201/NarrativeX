package com.narrativex.backend.modules.health.application.port.out;

public interface ProviderHealthSettings {
    boolean vertexGeminiEnabled();
    String location();
    String model();
}
