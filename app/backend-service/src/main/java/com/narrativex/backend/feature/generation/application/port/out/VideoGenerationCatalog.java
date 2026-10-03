package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import java.util.List;

public interface VideoGenerationCatalog {
  String defaultProvider();

  String defaultModel();

  String defaultQualityProfile();

  default String defaultProfile() {
    return "ltx-2.5-22b-distilled-int8-native-av-v1";
  }

  default String modelRevision() {
    return "5e6e71018ee1756ed329b697a7b4aedc934dfce9";
  }

  default String workflowRevision() {
    return "video.generate:1.1";
  }

  default String taskSchemaVersion() {
    return "1.1";
  }

  default List<GenerationStrategy> supportedStrategies() {
    return List.of(GenerationStrategy.TEXT_TO_VIDEO);
  }

  default List<String> supportedAspectRatios() {
    return List.of("16:9");
  }
}
