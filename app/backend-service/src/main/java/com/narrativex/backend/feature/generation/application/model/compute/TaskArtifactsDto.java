package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record TaskArtifactsDto(
    @JsonProperty("inputs") List<InputArtifactRefDto> inputs,
    @JsonProperty("outputs") List<OutputArtifactTargetDto> outputs) {

  public TaskArtifactsDto {
    if (inputs == null) {
      inputs = List.of();
    }
    if (outputs == null) {
      outputs = List.of();
    }
  }

  public static TaskArtifactsDto empty() {
    return new TaskArtifactsDto(List.of(), List.of());
  }
}
