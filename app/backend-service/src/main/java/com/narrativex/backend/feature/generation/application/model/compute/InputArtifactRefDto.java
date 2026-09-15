package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

public record InputArtifactRefDto(
    @JsonProperty("artifactId") UUID artifactId,
    @JsonProperty("role") String role,
    @JsonProperty("mediaType") String mediaType,
    @JsonProperty("sizeBytes") long sizeBytes,
    @JsonProperty("sha256") String sha256,
    @JsonProperty("access") ArtifactReadAccessDto access) {}
