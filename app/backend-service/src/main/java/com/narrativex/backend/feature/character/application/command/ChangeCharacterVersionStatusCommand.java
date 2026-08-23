package com.narrativex.backend.feature.character.application.command;

import java.util.UUID;

public record ChangeCharacterVersionStatusCommand(UUID characterVersionId, String actorId) {}
