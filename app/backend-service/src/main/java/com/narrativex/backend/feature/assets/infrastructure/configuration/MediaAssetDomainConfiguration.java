package com.narrativex.backend.feature.assets.infrastructure.configuration;

import com.narrativex.backend.feature.assets.domain.service.MediaAssetTransitionService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MediaAssetDomainConfiguration {
  @Bean
  MediaAssetTransitionService mediaAssetTransitionService() {
    return new MediaAssetTransitionService();
  }
}
