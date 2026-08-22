package com.narrativex.backend.feature.assets.infrastructure.storage;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "narrativex.storage.r2")
public record R2StorageProperties(
    String accountId,
    String accessKeyId,
    String secretAccessKey,
    String bucket,
    String endpoint,
    Duration presignDuration) {
  public R2StorageProperties {
    presignDuration = presignDuration == null ? Duration.ofMinutes(15) : presignDuration;
  }

  boolean configured() {
    return notBlank(accountId)
        && notBlank(accessKeyId)
        && notBlank(secretAccessKey)
        && notBlank(bucket)
        && validEndpoint();
  }

  private boolean validEndpoint() {
    if (!notBlank(endpoint)) return true;
    try {
      URI value = URI.create(endpoint.trim());
      return ("http".equalsIgnoreCase(value.getScheme())
              || "https".equalsIgnoreCase(value.getScheme()))
          && notBlank(value.getRawAuthority());
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  String effectiveEndpoint() {
    if (notBlank(endpoint)) return endpoint.trim().replaceAll("/$", "");
    return "https://" + accountId.trim() + ".r2.cloudflarestorage.com";
  }

  private static boolean notBlank(String value) {
    return value != null && !value.isBlank();
  }
}
