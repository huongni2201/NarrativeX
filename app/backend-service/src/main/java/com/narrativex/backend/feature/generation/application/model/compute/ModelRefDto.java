package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ModelRefDto(
    @JsonProperty("executor") String executor,
    @JsonProperty("model") String model,
    @JsonProperty("revision") String revision) {}
