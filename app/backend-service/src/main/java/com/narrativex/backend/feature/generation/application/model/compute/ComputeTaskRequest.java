package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import java.util.UUID;

public record ComputeTaskRequest(
    @JsonProperty("protocolVersion") String protocolVersion,
    @JsonProperty("taskId") UUID taskId,
    @JsonProperty("attemptId") UUID attemptId,
    @JsonProperty("idempotencyKey") String idempotencyKey,
    @JsonProperty("requestFingerprint") String requestFingerprint,
    @JsonProperty("task") TaskDescriptorDto task,
    @JsonProperty("model") ModelRefDto model,
    @JsonProperty("constraints") TaskConstraintsDto constraints,
    @JsonProperty("inputs") Map<String, Object> inputs,
    @JsonProperty("artifacts") TaskArtifactsDto artifacts) {

  public ComputeTaskRequest {
    if (protocolVersion == null) {
      protocolVersion = "1.0";
    }
    if (artifacts == null) {
      artifacts = TaskArtifactsDto.empty();
    }
  }
}
