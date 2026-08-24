package com.narrativex.backend.feature.character.api.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record AssignCharacterToProjectRequest(
    @NotNull UUID characterId,
    @NotBlank @Size(max = 64) String role,
    @Min(0) int importance,
    @Size(max = 20) List<@NotBlank @Size(max = 200) String> projectAliases,
    @Size(max = 8000) String storyMetadata,
    @Size(max = 20) List<@NotBlank @Size(max = 100) String> groups,
    UUID pinnedCharacterVersionId) {}
