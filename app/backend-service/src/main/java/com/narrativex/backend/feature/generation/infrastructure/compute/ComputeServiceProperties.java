package com.narrativex.backend.feature.generation.infrastructure.compute;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "narrativex.compute")
public class ComputeServiceProperties {
  private String baseUrl = "http://localhost:8010";
  private String machineToken = "default-dev-machine-token";
  private Duration connectTimeout = Duration.ofSeconds(10);
  private Duration readTimeout = Duration.ofSeconds(120);
}
