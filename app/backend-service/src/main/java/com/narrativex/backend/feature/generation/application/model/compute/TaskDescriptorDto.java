package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TaskDescriptorDto(
    @JsonProperty("type") String type,
    @JsonProperty("schemaVersion") String schemaVersion) {}
