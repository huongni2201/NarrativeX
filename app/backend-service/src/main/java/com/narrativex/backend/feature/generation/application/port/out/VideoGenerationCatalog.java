package com.narrativex.backend.feature.generation.application.port.out;

public interface VideoGenerationCatalog {
  String defaultProvider();

  String defaultModel();

  String defaultQualityProfile();

  default String modelRevision() {
    return "1.0";
  }

  default String workflowRevision() {
    return "video.generate:1.0";
  }
}
