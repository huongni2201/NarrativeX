package com.narrativex.backend.feature.character.api.request;

import jakarta.validation.constraints.NotBlank;
import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
import java.util.UUID;

public record CreateCharacterVersionRequest(
    @NotBlank String bible,
    String visualPrompt,
    CharacterVisualProfile visualProfile,
    UUID basedOnVersionId) {}
