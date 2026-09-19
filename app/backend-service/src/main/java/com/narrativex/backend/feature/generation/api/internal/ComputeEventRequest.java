package com.narrativex.backend.feature.generation.api.internal;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeErrorDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ExecutionMetricsDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ComputeEventRequest(
    @JsonProperty("eventId") String eventId,
    @JsonProperty("protocolVersion") String protocolVersion,
    @JsonProperty("taskId") UUID taskId,
    @JsonProperty("attemptId") UUID attemptId,
    @JsonProperty("sequence") long sequence,
    @JsonProperty("state") String state,
    @JsonProperty("executionHandle") String executionHandle,
    @JsonProperty("progress") Double progress,
    @JsonProperty("outputs") List<ProducedArtifactDto> outputs,
    @JsonProperty("metrics") ExecutionMetricsDto metrics,
    @JsonProperty("error") ComputeErrorDto error,
    @JsonProperty("occurredAt")
        @JsonFormat(
            shape = JsonFormat.Shape.STRING,
            pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
            timezone = "UTC")
        Instant occurredAt) {

  public ComputeEventRequest {
    if (outputs == null) {
      outputs = List.of();
    }
  }

  public ComputeObservationDto toObservationDto() {
    return new ComputeObservationDto(
        protocolVersion != null ? protocolVersion : "1.0",
        taskId,
        attemptId,
        state,
        (int) sequence,
        occurredAt != null ? occurredAt : Instant.now(),
        executionHandle,
        progress,
        outputs,
        metrics,
        error);
  }
}
