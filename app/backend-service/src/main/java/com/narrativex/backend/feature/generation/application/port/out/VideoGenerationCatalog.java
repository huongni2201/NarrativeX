package com.narrativex.backend.feature.generation.application.port.out;

public interface VideoGenerationCatalog {
  String defaultProvider();

  String defaultModel();

  String defaultQualityProfile();
}
