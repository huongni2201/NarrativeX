package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ComputeErrorDto(
    @JsonProperty("code") String code,
    @JsonProperty("category") String category,
    @JsonProperty("message") String message,
    @JsonProperty("retryAfterSeconds") Integer retryAfterSeconds,
    @JsonProperty("details") Map<String, Object> details) {

  public ComputeErrorDto {
    if (details == null) {
      details = Map.of();
    }
  }
}
