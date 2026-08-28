package com.narrativex.backend.feature.character.api.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PinCharacterVersionRequest(@NotNull UUID versionId) {}
