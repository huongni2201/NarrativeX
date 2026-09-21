package com.narrativex.backend.feature.generation.infrastructure.compute;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.Arrays;
import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "narrativex.compute")
public class ComputeServiceProperties {
  private String baseUrl = "http://localhost:8010";
  private String machineToken = "default-dev-machine-token";
  private String callbackSecret;
  private Duration connectTimeout = Duration.ofSeconds(10);
  private Duration readTimeout = Duration.ofSeconds(120);
  private Duration reconciliationTimeout = Duration.ofSeconds(30);
  private Duration reconciliationPollInterval = Duration.ofMillis(250);
  private String artifactBaseUrl = "http://localhost:8080";
  private Duration artifactTtl = Duration.ofMinutes(15);
  private long maxArtifactBytes = 256L * 1024L * 1024L;

  @Autowired(required = false)
  private Environment environment;

  @PostConstruct
  public void validateSecurityInvariants() {
    if (environment != null && Arrays.asList(environment.getActiveProfiles()).contains("prod")) {
      if (machineToken == null
          || machineToken.isBlank()
          || "default-dev-machine-token".equals(machineToken.trim())) {
        throw new IllegalStateException(
            "Production profile requires a non-default, secure narrativex.compute.machine-token");
      }
      if (callbackSecret != null
          && ("default-dev-machine-token".equals(callbackSecret.trim())
              || callbackSecret.isBlank())) {
        throw new IllegalStateException(
            "Production profile requires a non-default, secure narrativex.compute.callback-secret");
      }
    }
  }
}
