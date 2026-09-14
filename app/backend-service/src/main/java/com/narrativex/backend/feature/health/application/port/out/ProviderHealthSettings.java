package com.narrativex.backend.feature.health.application.port.out;

public interface ProviderHealthSettings {
  boolean qwenEnabled();

  String runtime();

  String model();
}
