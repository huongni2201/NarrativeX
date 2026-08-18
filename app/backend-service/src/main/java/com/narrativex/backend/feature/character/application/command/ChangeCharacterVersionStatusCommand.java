package com.narrativex.backend.feature.character.application.command;

public record ChangeCharacterVersionStatusCommand(Long characterVersionId, String actorId) {}
