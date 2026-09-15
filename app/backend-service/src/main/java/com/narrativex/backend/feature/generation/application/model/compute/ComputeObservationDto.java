package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ComputeObservationDto(
    @JsonProperty("protocolVersion") String protocolVersion,
    @JsonProperty("taskId") UUID taskId,
    @JsonProperty("attemptId") UUID attemptId,
    @JsonProperty("state") String state,
    @JsonProperty("sequence") int sequence,
    @JsonProperty("observedAt")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'", timezone = "UTC")
    Instant observedAt,
    @JsonProperty("executionHandle") String executionHandle,
    @JsonProperty("progress") Double progress,
    @JsonProperty("outputs") List<ProducedArtifactDto> outputs,
    @JsonProperty("metrics") ExecutionMetricsDto metrics,
    @JsonProperty("error") ComputeErrorDto error) {

  public ComputeObservationDto {
    if (outputs == null) {
      outputs = List.of();
    }
  }

  public boolean isTerminal() {
    return "SUCCEEDED".equalsIgnoreCase(state)
        || "FAILED".equalsIgnoreCase(state)
        || "CANCELED".equalsIgnoreCase(state);
  }

  public boolean isSucceeded() {
    return "SUCCEEDED".equalsIgnoreCase(state);
  }

  public boolean isFailed() {
    return "FAILED".equalsIgnoreCase(state);
  }

  public boolean isCanceled() {
    return "CANCELED".equalsIgnoreCase(state);
  }
}
