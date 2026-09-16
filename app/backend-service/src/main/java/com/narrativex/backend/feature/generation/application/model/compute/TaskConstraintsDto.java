package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record TaskConstraintsDto(
    @JsonProperty("deadline")
        @JsonFormat(
            shape = JsonFormat.Shape.STRING,
            pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
            timezone = "UTC")
        Instant deadline,
    @JsonProperty("maxRuntimeSeconds") int maxRuntimeSeconds) {}
