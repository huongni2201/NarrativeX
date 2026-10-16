package com.narrativex.backend.feature.character.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CreateCharacterVoiceProfileRequest(
    @NotNull @PositiveOrZero Long expectedRowVersion,
    @NotBlank @Size(max = 16) String language,
    @Size(max = 64) String accent,
    @NotBlank @Size(max = 2000) String voiceDescription,
    @Size(max = 2000) String deliveryBaseline) {}
