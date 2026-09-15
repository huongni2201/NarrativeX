package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExecutionMetricsDto(
    @JsonProperty("runtimeMs") Long runtimeMs,
    @JsonProperty("gpuTimeMs") Long gpuTimeMs,
    @JsonProperty("peakVramBytes") Long peakVramBytes) {}
