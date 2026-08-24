package com.narrativex.backend.feature.character.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateCharacterRequest(
    String workspaceId,
    @NotBlank @Size(max = 200) String canonicalName,
    @Size(max = 20) List<@NotBlank @Size(max = 200) String> aliases) {}
