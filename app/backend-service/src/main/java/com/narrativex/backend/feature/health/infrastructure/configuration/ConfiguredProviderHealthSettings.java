package com.narrativex.backend.feature.health.infrastructure.configuration;

import com.narrativex.backend.feature.health.application.port.out.ProviderHealthSettings;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConfiguredProviderHealthSettings implements ProviderHealthSettings {
  private final boolean vertexGeminiEnabled;
  private final String location;
  private final String model;

  public ConfiguredProviderHealthSettings(
      @Value("${narrativex.providers.vertex-gemini.enabled:false}") boolean vertexGeminiEnabled,
      @Value("${narrativex.providers.vertex-gemini.location:us-central1}") String location,
      @Value("${narrativex.providers.vertex-gemini.model:gemini-2.5-flash}") String model) {
    this.vertexGeminiEnabled = vertexGeminiEnabled;
    this.location = location;
    this.model = model;
  }

  public boolean vertexGeminiEnabled() {
    return vertexGeminiEnabled;
  }

  public String location() {
    return location;
  }

  public String model() {
    return model;
  }
}
