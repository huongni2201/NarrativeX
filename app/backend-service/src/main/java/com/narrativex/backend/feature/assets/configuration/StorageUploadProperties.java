package com.narrativex.backend.feature.assets.configuration;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** The single source of truth for upload intent lifetime. */
@ConfigurationProperties(prefix = "narrativex.storage")
public record StorageUploadProperties(Duration uploadIntentTtl) {
  private static final long MIN_SECONDS = Duration.ofMinutes(1).toSeconds();
  private static final long MAX_SECONDS = Duration.ofDays(7).toSeconds();

  public StorageUploadProperties {
    uploadIntentTtl = uploadIntentTtl == null ? Duration.ofMinutes(15) : uploadIntentTtl;
    long seconds = uploadIntentTtl.toSeconds();
    if (seconds < MIN_SECONDS || seconds > MAX_SECONDS || seconds <= 0) {
      throw new IllegalArgumentException(
          "narrativex.storage.upload-intent-ttl must be between 1 minute and 7 days");
    }
  }
}
