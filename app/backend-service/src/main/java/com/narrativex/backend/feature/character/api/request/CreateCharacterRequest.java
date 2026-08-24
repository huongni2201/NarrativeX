package com.narrativex.backend.feature.character.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateCharacterRequest(
    @Size(max = 128) String workspaceId,
    @NotBlank @Size(max = 160) String canonicalName,
    @Size(max = 20) List<@NotBlank @Size(max = 200) String> aliases) {}
