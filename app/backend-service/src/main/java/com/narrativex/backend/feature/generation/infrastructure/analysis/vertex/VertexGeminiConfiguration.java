package com.narrativex.backend.feature.generation.infrastructure.analysis.vertex;

import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

/**
 * Spring configuration wiring Vertex AI client and provider beans.
 */
@Configuration
public class VertexGeminiConfiguration {

  @Bean
  @ConditionalOnMissingBean
  public VertexGeminiClient vertexGeminiClient(
      VertexGeminiProperties properties, ObjectMapper objectMapper) {
    return new VertexGeminiClient(properties, objectMapper);
  }

  @Bean
  @ConditionalOnProperty(
      prefix = "narrativex.providers.vertex-gemini",
      name = "enabled",
      havingValue = "false",
      matchIfMissing = true)
  @ConditionalOnMissingBean(ChapterAnalysisProvider.class)
  public ChapterAnalysisProvider disabledChapterAnalysisProvider() {
    return new DisabledChapterAnalysisProvider();
  }
}
