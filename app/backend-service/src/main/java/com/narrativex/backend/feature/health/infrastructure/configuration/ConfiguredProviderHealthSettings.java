package com.narrativex.backend.feature.health.infrastructure.configuration;

import com.narrativex.backend.feature.health.application.port.out.ProviderHealthSettings;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConfiguredProviderHealthSettings implements ProviderHealthSettings {
  private final boolean vertexGeminiEnabled;
  private final String vertexGeminiModel;
  private final String vertexGeminiLocation;

  public ConfiguredProviderHealthSettings(
      @Value("${narrativex.providers.vertex-gemini.enabled:false}") boolean vertexGeminiEnabled,
      @Value("${narrativex.providers.vertex-gemini.model:gemini-3.8-flash}") String vertexGeminiModel,
      @Value("${narrativex.providers.vertex-gemini.location:us-central1}") String vertexGeminiLocation) {
    this.vertexGeminiEnabled = vertexGeminiEnabled;
    this.vertexGeminiModel = vertexGeminiModel;
    this.vertexGeminiLocation = vertexGeminiLocation;
  }

  @Override
  public boolean vertexGeminiEnabled() {
    return vertexGeminiEnabled;
  }

  @Override
  public String vertexGeminiModel() {
    return vertexGeminiModel;
  }

  @Override
  public String vertexGeminiLocation() {
    return vertexGeminiLocation;
  }
}
