package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

public record ProducedArtifactDto(
    @JsonProperty("artifactId") UUID artifactId,
    @JsonProperty("role") String role,
    @JsonProperty("mediaType") String mediaType,
    @JsonProperty("sizeBytes") long sizeBytes,
    @JsonProperty("sha256") String sha256,
    @JsonProperty("technicalMetadata") TechnicalMetadata technicalMetadata) {
  public ProducedArtifactDto(
      UUID artifactId, String role, String mediaType, long sizeBytes, String sha256) {
    this(artifactId, role, mediaType, sizeBytes, sha256, null);
  }

  public record TechnicalMetadata(
      long durationMs, int width, int height, double fps, boolean hasAudio, boolean decodePassed) {
    public boolean matchesNativeProfile() {
      return durationMs > 0
          && width == 1280
          && height == 720
          && Double.isFinite(fps)
          && Math.abs(fps - 24.0) < 0.01
          && hasAudio
          && decodePassed;
    }
  }
}
