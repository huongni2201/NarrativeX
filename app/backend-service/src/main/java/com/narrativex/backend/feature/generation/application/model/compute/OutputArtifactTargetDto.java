package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

public record OutputArtifactTargetDto(
    @JsonProperty("artifactId") UUID artifactId,
    @JsonProperty("role") String role,
    @JsonProperty("mediaType") String mediaType,
    @JsonProperty("access") ArtifactWriteAccessDto access) {}
