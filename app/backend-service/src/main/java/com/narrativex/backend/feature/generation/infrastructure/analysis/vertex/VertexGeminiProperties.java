package com.narrativex.backend.feature.generation.infrastructure.analysis.vertex;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for Vertex AI Gemini chapter analysis adapter.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "narrativex.providers.vertex-gemini")
public class VertexGeminiProperties {

  /** Whether the Vertex AI Gemini provider is enabled. */
  private boolean enabled = false;

  /** Google Cloud project ID. */
  private String projectId = "";

  /** Google Cloud region/location (e.g. "us-central1" or "global"). */
  private String location = "us-central1";

  /** Target Gemini model name. */
  private String model = "gemini-3.8-flash";

  /** Thinking level ("HIGH", "MEDIUM", "LOW", "NONE"). Default: "HIGH". */
  private String thinkingLevel = "HIGH";

  /** Maximum allowed output tokens. */
  private int maxOutputTokens = 65536;

  /** Soft token cap on chapter input before rejecting. */
  private int softInputTokenLimit = 800000;

  /** Timeout duration for chapter analysis requests. */
  private Duration timeout = Duration.ofSeconds(900);

  /** Optional explicit bearer token for test/dev environments without ADC. */
  private String bearerToken = "";

  /** Optional explicit API key for endpoints supporting key-based auth. */
  private String apiKey = "";
}
