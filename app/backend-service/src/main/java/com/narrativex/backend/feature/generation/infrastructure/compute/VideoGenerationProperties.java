package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "narrativex.video")
public class VideoGenerationProperties implements VideoGenerationCatalog {
  private String defaultProvider = "ltx";
  private String defaultModel = "ltx-2.5-nvfp4";
  private String defaultQualityProfile = "720p_24fps_standard";
  private String defaultProfile = "ltx-2.5-22b-distilled-int8-native-av-v1";
  private String modelRevision = "1.0";
  private String workflowRevision = "video.generate:1.0";
  private List<GenerationStrategy> supportedStrategies =
      List.of(GenerationStrategy.TEXT_TO_VIDEO);

  @Override
  public String defaultProfile() {
    return defaultProfile;
  }

  @Override
  public List<GenerationStrategy> supportedStrategies() {
    return supportedStrategies != null && !supportedStrategies.isEmpty()
        ? supportedStrategies
        : List.of(GenerationStrategy.TEXT_TO_VIDEO);
  }

  @Override
  public String modelRevision() {
    return modelRevision;
  }

  @Override
  public String workflowRevision() {
    return workflowRevision;
  }

  @Override
  public String defaultProvider() {
    return defaultProvider;
  }

  @Override
  public String defaultModel() {
    return defaultModel;
  }

  @Override
  public String defaultQualityProfile() {
    return defaultQualityProfile;
  }
}
