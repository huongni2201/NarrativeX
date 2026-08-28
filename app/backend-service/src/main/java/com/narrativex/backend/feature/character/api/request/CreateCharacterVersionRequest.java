package com.narrativex.backend.feature.character.api.request;

import jakarta.validation.constraints.NotBlank;

public record CreateCharacterVersionRequest(
    @NotBlank String bible,
    @NotBlank String visualPrompt) {}
