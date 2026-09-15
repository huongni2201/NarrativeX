package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ArtifactWriteAccessDto(
    @JsonProperty("method") String method,
    @JsonProperty("url") String url,
    @JsonProperty("expiresAt")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    Instant expiresAt,
    @JsonProperty("headers") Map<String, String> headers) {

  public ArtifactWriteAccessDto {
    if (headers == null) {
      headers = Map.of();
    }
  }
}
