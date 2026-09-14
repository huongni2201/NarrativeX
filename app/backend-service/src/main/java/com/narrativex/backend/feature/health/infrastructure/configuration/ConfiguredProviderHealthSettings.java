package com.narrativex.backend.feature.health.infrastructure.configuration;

import com.narrativex.backend.feature.health.application.port.out.ProviderHealthSettings;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConfiguredProviderHealthSettings implements ProviderHealthSettings {
  private final boolean qwenEnabled;
  private final String runtime;
  private final String model;

  public ConfiguredProviderHealthSettings(
      @Value("${narrativex.providers.qwen.enabled:false}") boolean qwenEnabled,
      @Value("${narrativex.providers.qwen.runtime:vllm-local}") String runtime,
      @Value("${narrativex.providers.qwen.model:Qwen/Qwen3-8B-AWQ}") String model) {
    this.qwenEnabled = qwenEnabled;
    this.runtime = runtime;
    this.model = model;
  }

  public boolean qwenEnabled() {
    return qwenEnabled;
  }

  public String runtime() {
    return runtime;
  }

  public String model() {
    return model;
  }
}
