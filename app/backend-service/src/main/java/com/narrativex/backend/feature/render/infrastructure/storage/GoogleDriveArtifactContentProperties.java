package com.narrativex.backend.feature.render.infrastructure.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "narrativex.storage.google-drive")
public record GoogleDriveArtifactContentProperties(
    String clientId,
    String clientSecret,
    String refreshToken,
    String folderId,
    long timeoutSeconds) {

  boolean configured() {
    return notBlank(clientId)
        && notBlank(clientSecret)
        && notBlank(refreshToken)
        && notBlank(folderId);
  }

  private static boolean notBlank(String value) {
    return value != null && !value.isBlank();
  }
}
